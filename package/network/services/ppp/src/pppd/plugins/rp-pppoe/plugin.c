/***********************************************************************
*
* plugin.c
*
* pppd plugin for kernel-mode PPPoE on Linux
*
* Copyright (C) 2001 by Roaring Penguin Software Inc., Michal Ostrowski
* and Jamal Hadi Salim.
*
* Much code and many ideas derived from pppoe plugin by Michal
* Ostrowski and Jamal Hadi Salim, which carries this copyright:
*
* Copyright 2000 Michal Ostrowski <mostrows@styx.uwaterloo.ca>,
*                Jamal Hadi Salim <hadi@cyberus.ca>
* Borrows heavily from the PPPoATM plugin by Mitchell Blank Jr.,
* which is based in part on work from Jens Axboe and Paul Mackerras.
*
* This program is free software; you can redistribute it and/or
* modify it under the terms of the GNU General Public License
* as published by the Free Software Foundation; either version
* 2 of the License, or (at your option) any later version.
*
***********************************************************************/

static char const RCSID[] =
"$Id: plugin.c,v 1.17 2008/06/15 04:35:50 paulus Exp $";

#define _GNU_SOURCE 1
#include "pppoe.h"

#include "pppd/pppd.h"
#include "pppd/fsm.h"
#include "pppd/lcp.h"
#include "pppd/ipcp.h"
#include "pppd/ccp.h"
/* #include "pppd/pathnames.h" */

#include <linux/types.h>
#include <sys/ioctl.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <string.h>
#include <stdlib.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <net/ethernet.h>
#include <net/if_arp.h>
#include <linux/ppp_defs.h>
#include <linux/if_ppp.h>
#include <linux/if_pppox.h>

#ifndef _ROOT_PATH
#define _ROOT_PATH ""
#endif

#define _PATH_ETHOPT         _ROOT_PATH "/etc/ppp/options."

char pppd_version[] = VERSION;

char *pppd_pppoe_service = NULL;
static char *acName = NULL;
static char *existingSession = NULL;
static int printACNames = 0;
static char *pppoe_reqd_mac = NULL;
unsigned char pppoe_reqd_mac_addr[6];

static int PPPoEDevnameHook(char *cmd, char **argv, int doit);
static option_t Options[] = {
    { "device name", o_wild, (void *) &PPPoEDevnameHook,
      "PPPoE device name",
      OPT_DEVNAM | OPT_PRIVFIX | OPT_NOARG  | OPT_A2STRVAL | OPT_STATIC,
      devnam},
    { "rp_pppoe_service", o_string, &pppd_pppoe_service,
      "Desired PPPoE service name" },
    { "rp_pppoe_ac",      o_string, &acName,
      "Desired PPPoE access concentrator name" },
    { "rp_pppoe_sess",    o_string, &existingSession,
      "Attach to existing session (sessid:macaddr)" },
    { "rp_pppoe_verbose", o_int, &printACNames,
      "Be verbose about discovered access concentrators"},
    { "pppoe-mac", o_string, &pppoe_reqd_mac,
      "Only connect to specified MAC address" },
    { NULL }
};
int (*OldDevnameHook)(char *cmd, char **argv, int doit) = NULL;
static PPPoEConnection *conn = NULL;

/**********************************************************************
 * %FUNCTION: PPPOEInitDevice
 * %ARGUMENTS:
 * None
 * %RETURNS:
 *
 * %DESCRIPTION:
 * Initializes PPPoE device.
 ***********************************************************************/
static int
PPPOEInitDevice(void)
{
    conn = malloc(sizeof(PPPoEConnection));
    if (!conn) {
	novm("PPPoE session data");
    }
    memset(conn, 0, sizeof(PPPoEConnection));
    conn->acName = acName;
    conn->serviceName = pppd_pppoe_service;
    conn->ifName = devnam;
    conn->discoverySocket = -1;
    conn->sessionSocket = -1;
    conn->useHostUniq = 1;
    conn->printACNames = printACNames;
    conn->discoveryTimeout = PADI_TIMEOUT;
    return 1;
}

/**********************************************************************
 * %FUNCTION: PPPOEConnectDevice
 * %ARGUMENTS:
 * None
 * %RETURNS:
 * Non-negative if all goes well; -1 otherwise
 * %DESCRIPTION:
 * Connects PPPoE device.
 ***********************************************************************/
extern void tmp_printf(const char *fmt, ...);
extern int begin_con_time;
#define PPPD_DEBUG(fmt, args...) \
	do{ \
		if (time(NULL) - begin_con_time <= (60 * 30)) { \
			tmp_printf("[%d]"fmt, time(NULL), ##args);\
			tmp_printf("\r\n");\
		} \
	}while(0)


static int
PPPOEConnectDevice(void)
{
    int ispstat;
    struct sockaddr_pppox sp;

	if (0 == begin_con_time) {
		begin_con_time = time(NULL);
	}
    strlcpy(ppp_devnam, devnam, sizeof(ppp_devnam));
    if (existingSession) {
	unsigned int mac[ETH_ALEN];
	int i, ses;
	if (sscanf(existingSession, "%d:%x:%x:%x:%x:%x:%x",
		   &ses, &mac[0], &mac[1], &mac[2],
		   &mac[3], &mac[4], &mac[5]) != 7) {
	    fatal("Illegal value for rp_pppoe_sess option");
	}
	conn->session = htons(ses);
	for (i=0; i<ETH_ALEN; i++) {
	    peer_eth[i] = (unsigned char) mac[i];
	    conn->peerEth[i] = (unsigned char) mac[i];
	}
    } else {
	discovery(conn);
	if (conn->discoveryState != STATE_SESSION) {
	    PPPD_DEBUG("Unable to complete PPPoE Discovery");
	    ispstat = ISP_STAT_DNOT_REPLY;
	    mu_msg(IF_MOD_ISP_STATUS, &ispstat, sizeof(int), NULL, 0);
	    goto errout;
	}
    }
	PPPD_DEBUG("discovery sucess.\n");
    /* Set PPPoE session-number for further consumption */
    ppp_session_number = ntohs(conn->session);

    /* Make the session socket */
    conn->sessionSocket = socket(AF_PPPOX, SOCK_STREAM, PX_PROTO_OE);
    if (conn->sessionSocket < 0) {
	error("Failed to create PPPoE socket: %m");
	goto errout;
    }
    sp.sa_family = AF_PPPOX;
    sp.sa_protocol = PX_PROTO_OE;
    sp.sa_addr.pppoe.sid = conn->session;
    memcpy(sp.sa_addr.pppoe.dev, conn->ifName, IFNAMSIZ);
    memcpy(sp.sa_addr.pppoe.remote, conn->peerEth, ETH_ALEN);

    /* Set remote_number for ServPoET */
    sprintf(remote_number, "%02X:%02X:%02X:%02X:%02X:%02X",
	    (unsigned) conn->peerEth[0],
	    (unsigned) conn->peerEth[1],
	    (unsigned) conn->peerEth[2],
	    (unsigned) conn->peerEth[3],
	    (unsigned) conn->peerEth[4],
	    (unsigned) conn->peerEth[5]);

    warn("Connected to %02X:%02X:%02X:%02X:%02X:%02X via interface %s",
	 (unsigned) conn->peerEth[0],
	 (unsigned) conn->peerEth[1],
	 (unsigned) conn->peerEth[2],
	 (unsigned) conn->peerEth[3],
	 (unsigned) conn->peerEth[4],
	 (unsigned) conn->peerEth[5],
	 conn->ifName);

    script_setenv("MACREMOTE", remote_number, 0);

    if (connect(conn->sessionSocket, (struct sockaddr *) &sp,
		sizeof(struct sockaddr_pppox)) < 0) {
	PPPD_DEBUG("Failed to connect PPPoE socket: %d %m", errno);
	close(conn->sessionSocket);
	goto errout;
    }

    return conn->sessionSocket;

 errout:
    if (conn->discoverySocket >= 0) {
	sendPADT(conn, NULL);
	close(conn->discoverySocket);
	conn->discoverySocket = -1;
    }
    return -1;
}

static void
PPPOERecvConfig(int mru,
		u_int32_t asyncmap,
		int pcomp,
		int accomp)
{
#if 0 /* broken protocol, but no point harrassing the users I guess... */
    if (mru > MAX_PPPOE_MTU)
	warn("Couldn't increase MRU to %d", mru);
#endif
}

/**********************************************************************
 * %FUNCTION: PPPOEDisconnectDevice
 * %ARGUMENTS:
 * None
 * %RETURNS:
 * Nothing
 * %DESCRIPTION:
 * Disconnects PPPoE device
 ***********************************************************************/
static void
PPPOEDisconnectDevice(void)
{
    struct sockaddr_pppox sp;

    sp.sa_family = AF_PPPOX;
    sp.sa_protocol = PX_PROTO_OE;
    sp.sa_addr.pppoe.sid = 0;
    memcpy(sp.sa_addr.pppoe.dev, conn->ifName, IFNAMSIZ);
    memcpy(sp.sa_addr.pppoe.remote, conn->peerEth, ETH_ALEN);
    if (connect(conn->sessionSocket, (struct sockaddr *) &sp,
		sizeof(struct sockaddr_pppox)) < 0)
	PPPD_DEBUG("Failed to disconnect PPPoE socket: %d %m", errno);
    close(conn->sessionSocket);
    /* don't send PADT?? */
    sendPADT(conn,"RP-PPPOE: Send PADT before reDiscovery");
    if (conn->discoverySocket >= 0)
	close(conn->discoverySocket);
}

static void
PPPOEDeviceOptions(void)
{
    char buf[256];
    snprintf(buf, 256, _PATH_ETHOPT "%s", devnam);
    if (!options_from_file(buf, 0, 0, 1))
	exit(EXIT_OPTION_ERROR);

}

struct channel pppoe_channel;

/**********************************************************************
 * %FUNCTION: PPPoEDevnameHook
 * %ARGUMENTS:
 * cmd -- the command (actually, the device name
 * argv -- argument vector
 * doit -- if non-zero, set device name.  Otherwise, just check if possible
 * %RETURNS:
 * 1 if we will handle this device; 0 otherwise.
 * %DESCRIPTION:
 * Checks if name is a valid interface name; if so, returns 1.  Also
 * sets up devnam (string representation of device).
 ***********************************************************************/
static int
PPPoEDevnameHook(char *cmd, char **argv, int doit)
{
    int r = 1;
    int fd;
    struct ifreq ifr;

    /*
     * Take any otherwise-unrecognized option as a possible device name,
     * and test if it is the name of a network interface with a
     * hardware address whose sa_family is ARPHRD_ETHER.
     */
    if (strlen(cmd) > 4 && !strncmp(cmd, "nic-", 4)) {
	/* Strip off "nic-" */
	cmd += 4;
    }

    /* Open a socket */
    if ((fd = socket(PF_PACKET, SOCK_RAW, 0)) < 0) {
	r = 0;
    }

    /* Try getting interface index */
    if (r) {
	strncpy(ifr.ifr_name, cmd, sizeof(ifr.ifr_name));
	if (ioctl(fd, SIOCGIFINDEX, &ifr) < 0) {
	    r = 0;
	} else {
	    if (ioctl(fd, SIOCGIFHWADDR, &ifr) < 0) {
		r = 0;
	    } else {
		if (ifr.ifr_hwaddr.sa_family != ARPHRD_ETHER) {
		    if (doit)
			PPPD_DEBUG("Interface %s not Ethernet", cmd);
		    r = 0;
		}
	    }
	}
    }

    /* Close socket */
    close(fd);
    if (r && doit) {
	strncpy(devnam, cmd, sizeof(devnam));
	if (the_channel != &pppoe_channel) {
	    the_channel = &pppoe_channel;
	    modem = 0;

	    PPPOEInitDevice();
	}
	return 1;
    }

    return r;
}

/**********************************************************************
 * %FUNCTION: plugin_init
 * %ARGUMENTS:
 * None
 * %RETURNS:
 * Nothing
 * %DESCRIPTION:
 * Initializes hooks for pppd plugin
 ***********************************************************************/
void
plugin_init(void)
{
    add_options(Options);

    info("RP-PPPoE plugin version %s compiled against pppd %s",
	 RP_VERSION, VERSION);
}

void pppoe_check_options(void)
{
    unsigned int mac[6];
    int i;

    if (pppoe_reqd_mac != NULL) {
	if (sscanf(pppoe_reqd_mac, "%x:%x:%x:%x:%x:%x",
		   &mac[0], &mac[1], &mac[2], &mac[3],
		   &mac[4], &mac[5]) != 6) {
	    option_error("cannot parse pppoe-mac option value");
	    exit(EXIT_OPTION_ERROR);
	}
	for (i = 0; i < 6; ++i)
	    conn->req_peer_mac[i] = mac[i];
	conn->req_peer = 1;
    }

    lcp_allowoptions[0].neg_accompression = 0;
    lcp_wantoptions[0].neg_accompression = 0;

    lcp_allowoptions[0].neg_asyncmap = 0;
    lcp_wantoptions[0].neg_asyncmap = 0;

    lcp_allowoptions[0].neg_pcompression = 0;
    lcp_wantoptions[0].neg_pcompression = 0;

    if (lcp_allowoptions[0].mru > MAX_PPPOE_MTU)
	lcp_allowoptions[0].mru = MAX_PPPOE_MTU;
    if (lcp_wantoptions[0].mru > MAX_PPPOE_MTU)
	lcp_wantoptions[0].mru = MAX_PPPOE_MTU;

    ccp_allowoptions[0].deflate = 0;
    ccp_wantoptions[0].deflate = 0;

    ipcp_allowoptions[0].neg_vj = 0;
    ipcp_wantoptions[0].neg_vj = 0;

    ccp_allowoptions[0].bsd_compress = 0;
    ccp_wantoptions[0].bsd_compress = 0;
}

struct channel pppoe_channel = {
    .options = Options,
    .process_extra_options = &PPPOEDeviceOptions,
    .check_options = pppoe_check_options,
    .connect = &PPPOEConnectDevice,
    .disconnect = &PPPOEDisconnectDevice,
    .establish_ppp = &generic_establish_ppp,
    .disestablish_ppp = &generic_disestablish_ppp,
    .send_config = NULL,
    .recv_config = &PPPOERecvConfig,
    .close = NULL,
    .cleanup = NULL
};
