﻿/**
* Created with JetBrains PhpStorm.
* User: poppy
* Date: 12-12-18
* Time: 下午5:32
* To change this template use File | Settings | File Templates.
*/
var isWizard = document.location.pathname.indexOf("/app/wizard/")>=0;
var wizardStr = isWizard?"&delay=1":"";

//保存的模式
var iMode;
function empty(){}

//主要开关
var iS0 = $.query("#[S0_1,S0_2,S0_3]").on("vclick", function () {
	if (iS0.viewed) {
		iS0.viewed.className = "iRadio_2";
		$(iS0.viewed.id + "c").style.display = "none";
	}
	iS0.viewed = this;
	this.className = "iRadio_2 iRadio_elect";
	$(this.id + "c").style.display = "block";
	$.systemPadResize();
	$("submit").style.cssText = "";
	iS0["get" + this.id]();
	autoswitch();
	return false;
}).$;

iS0.getS0_1 = function () {
	getAp(true);
	iS0.getS0_1 = empty;
};
iS0.getS0_2 = function () {
	getWan();
	iS0.getS0_2 = empty;
};
iS0.getS0_3 = function () {
	//$("submit").style = isWizard ? "" : "display:none";
	get3G();
	iS0.getS0_3 = empty;
};

var iS1 = $.query("#[S1_0,S1_1]").on("vclick", function () {
	if (iS1.viewed) {
		iS1.viewed.className = "iRadio_1";
		$(iS1.viewed.id + "c").style.display = "none";
	}
	iS1.viewed = this;
	this.className = "iRadio_1 iRadio_elect";
	$(this.id + "c").style.display = "block";
	$.systemPadResize();
	return false;
});

var iS2 = $.query("#[S2_0,S2_1,S2_2]").on("vclick", function () {
	if (iS2.viewed) {
		iS2.viewed.className = "iRadio_1";
		$(iS2.viewed.id + "c").style.display = "none";
	}
	iS2.viewed = this;
	this.className = "iRadio_1 iRadio_elect";
	$(this.id + "c").style.display = "block";
	$.systemPadResize();
	iS2["get" + this.id]();
	return false;
});
iS2.getS2_0 = empty;
iS2.getS2_1 = empty;
iS2.getS2_2 = function () {
	$.Ajax.get("/protocol.csp?fname=net&opt=wifi_wan_pppoe&function=get&encode=1" + wizardStr, function () {
		if (this.error == null) {
			var x = $.xjson(this.responseXML, "wifi_wan_pppoe", true);
			$("s2_2_user").value = decodeURIComponent(x.user) || "";
			$("s2_2_passwd").value = decodeURIComponent(x.passwd) || "";
			$("s2_2_servername").value = decodeURIComponent(x.servername) || "";
			$("s2_2_DNS1").value = x.DNS1 || "";
			$("s2_2_DNS2").value = x.DNS2 || "";	
		}
	});
	iS2.getS2_2 = empty;
};
$.dom.on($("ap_rescan"),"vclick",function(){
	getAp(true);
});
$.dom.on($("SSIDs"), "vclick", function () {
    $.query("#SSIDs > div").attr("style", "");
	var v = $.dom.getEvent().target.getAttribute("v");
	if(v == "hide"){
		if(isWizard){
			$.vhref("wizard/hide.html");
		}else{
			$.vhref("network/hide.html");
		}
		return ;
	}
	if(v){
		var ssidDom = $("SSID_" + v);
		if(ssidDom.className.indexOf("iRadio_elect") < 0){
			ssidDom.style.backgroundImage = "none";
		}
		ssidDom.style.margin = "0";
		ssidDom.style.backgroundColor = "#CCCCCC";
		
	}
	//	var lastSelectSSID = $("SSID_" + this.v);
	//	if(lastSelectSSID){
	//		if(lastSelectSSID.className.indexOf("iRadio_error") > -1){
	//			lastSelectSSID.className = "iRadio_1";
	//		}
	//	}
	
	this.v = v;

	$("s1_0_passwd").value = iAps[v].passwd;
	//ap_静态ip
	if(iAps[v].dhcp == 0){
		$("s1_0_ip").value = iAps[v].ip || "";
		$("s1_0_mask").value = iAps[v].mask || "";
		$("s1_0_gateway").value = iAps[v].gateway || "";
		$("s1_0_DNS1").value = iAps[v].DNS1 || "";
		$("s1_0_DNS2").value = iAps[v].DNS2 || "";
	    //dhcp
	}
    else{
		iAp.dhcp = 1;
		$("S1_0c").style.display = "none";
	}
	var dh = iAps[v].dhcp || 1;
	$.dom.on($("S1_" + dh), "vclick");
	return false;
});
$.dom.on($("s1_0_passwd"),"focus",function(){
	this.select();
	this.type = "text";
	autoScanAp(true);//关闭自动刷新
});
$.dom.on($("s1_0_passwd"),"blur",function(){
	this.type = "password";
	autoScanAp();//启动自动刷新
});
//获取网络是否联通
var timeNum = 0;
function getInterNet(successLge,errorLge){
	$.msg.openLoad();
	var msg;
	setTimeout(function(){
		$.Ajax.get("/protocol.csp?fname=net&opt=pppoe_status&function=get",function(){
		   $.msg.closeLoad();
			var x = $.xjson(this.responseXML,"status",true);
			if(x =="1"){
				  msg = successLge;
			}else{
				  if(timeNum < 5){
					timeNum += 1;
				    getInterNet(successLge,errorLge);
					return ;
				  }else{
					 msg = errorLge;
				  }
			}
			timeNum = 0;
			msg ? $.msg.alert(msg) : "";
			
		});
	},3000);
}
//获取无线网络
var iAps, iAp = {};
function getAp(s,flagLoad) {
		var needscan =  "";
		if(flagLoad){//扫描状态，无需更新
			needscan = wizardStr + "&needscan=0";
		}else{
			$.msg.openLoad(); 
			needscan = wizardStr + "&needscan=1";
		}
		var HideObj = {};//获取Ap列表前，先检查是否有连接隐藏SSID
		$.Ajax.get("/protocol.csp?fname=net&opt=wifi_linkssid&encode=1&function=get" + wizardStr + "&t=" + new Date().getTime(),function(){
			if(!this.error){
				if($.config.hasHideSSID){
					var hideap  = $.xjson(this.responseXML,"linkssid",true);
					if(hideap["default"] == 1){
						try{
							hideap.SSID = decodeURIComponent(hideap.SSID); //防止编码错误
							hideap.utf = 1;
						}catch(e){
							hideap.SSID = unescape(hideap.SSID);
							hideap.utf = 0;
						}
						
						HideObj = hideap;
					}
				}
			}
            //获取AP
            //这里获取列表与AP列表建议分开，毕竟获取ap列表比较慢
            $.Ajax.get("/protocol.csp?fname=net&opt=wifi_client&function=get&encode=1" + needscan + "&t=" + new Date().getTime(), function () {
                $.msg.closeLoad();
                //返回前清空密码(刷新状态就不移除密码)
				if(!flagLoad){
				 $("s1_0_passwd").value = "";
				}
              if (!this.error) {
					var aps = iAps = $.xjson(this.responseXML, "ap"),d = $("SSIDs"),len = 0;
					//解码
					for(var n in aps){
						try{
							aps[n].SSID = iAps[n].SSID = decodeURIComponent(aps[n].SSID);
							aps[n].utf = iAps[n].utf = 1;
						}catch(e){
							aps[n].SSID = iAps[n].SSID = unescape(aps[n].SSID);
							aps[n].utf = iAps[n].utf = 0;
						}
					  
						aps[n].passwd = iAps[n].passwd = decodeURIComponent(aps[n].passwd);
					}
					for(var i=0;i<aps.length;i++){
						if(HideObj != null){
							if(aps[i].SSID == HideObj.SSID){
								aps.splice(i,1)[0];//splice(下标,个数)
								if(i == aps.length-1){
									aps.unshift(HideObj);
									break;
								}
							}else{
								//当数据循环、未检测到集合存在隐藏SSID、将数据填充到AP集合
								if(i == aps.length-1){
									aps.unshift(HideObj);
									break;
								}
							}
						}
						
						if(aps[i]["default"] == 1 || aps[i]["default"] == 2){
							 aps.unshift(aps.splice(i,1)[0]);
						}
						else if(aps[i].SSID == ""){
							aps.splice(i,1);
						}
					}
					var HideSSID;
					if($.config.hasHideSSID){
						HideSSID = ['<div class="iRadio_1" v="hide" style="font-weight:bold;">'+ $.lge.get("Setting_Network_Hide") +'...</div>'];
					}
					d.innerHTML = $.forEach(aps, function (v, i) {
						v.passwd = (v.passwd || "").trim();
						if(aps[i]["default"] == 1 || aps[i]["default"] == 2) {
							iAp.num = i;
							for(var n in v) {
								iAp[n] = v[n];
							}
						}
						if(v.SSID){
							len += 1;
							if(v["default"] == 1){
								return '<div class="iRadio_1 iRadio_elect" title="'+ $.lge.get("Setting_DDNS_Success") +'" id="SSID_' + i + '" v="' + i + '">' + v.SSID + '</div><span class="iItem_line1" style="display:block"></span>';
							}else if(v["default"] == 2){
								return '<div class="iRadio_1 iRadio_error" title="'+ $.lge.get("Setting_DDNS_Fail") +'" id="SSID_' + i + '" v="' + i + '">' + v.SSID + '</div><span class="iItem_line1" style="display:block"></span>';
							}else{
								return '<div class="iRadio_1" id="SSID_' + i + '" v="' + i + '">' + v.SSID + '</div><span class="iItem_line1" style="display:block"></span>';
							}
						}
						return "";
					}, []).concat(HideSSID).join("");

					d.style.marginTop = "0px";
					d.parentNode.style.overflow = "hidden";
					d.parentNode.style.height = len>6?"200px":"auto";
					$.reScrollPlate(d);
					$.systemPadResize();
					if(s){
						if (iAp.SSID && iAp["default"] == 1) {
							if($("SSID_" + iAp.num) != null){
								$("s1_0_passwd").value = decodeURIComponent(iAp.passwd);
								$("SSID_" + iAp.num).className = "iRadio_1 iRadio_elect";
								$("SSID_" + iAp.num).v = iAp.num;
								d.v = iAp.num;
								$("s1_0_ip").value = iAp.ip || "";
								$("s1_0_mask").value = iAp.mask || "";
								$("s1_0_gateway").value = iAp.gateway || "";
								$("s1_0_DNS1").value = iAp.DNS1 || "";
								$("s1_0_DNS2").value = iAp.DNS2 || "";
							}

						}
						else {
							iAp.dhcp = 1;
						}
						$.dom.on($("S1_" + (iAp.dhcp || "1")), "vclick");
					}
				}
                get5GAp(d,needscan);
            });
		});
		
}
//30秒定期获取ap列表
window.TIMEAP  = "";
function autoScanAp(flag){
	if(flag){
		clearInterval(TIMEAP);
	}else{
		window.TIMEAP = setInterval(function(){	
			getAp(false,true);
		},30*1000);
	}
}
autoScanAp(); //默认开启

//获取5g
function get5GAp(dom,needscan){
	var d = dom,iap = iAps;
	$.Ajax.get("/protocol.csp?fname=net&opt=wifi_5gclient&encode=1&function=get" + needscan+  "&t=" + new Date().getTime(),function(){
		if(this.error){
			return true;
		}
		var wifi5g = $.xjson(this.responseXML, "ap");
		var ipaLength = iap.length;
		for(var n in wifi5g){
			if(!wifi5g[n].SSID){
				continue;
			}
			wifi5g[n]["t"] = 1;
			iAps.push(wifi5g[n]);
			var i = Number(n) +  ipaLength;
			var span = document.createElement("span");
				span.className = "iItem_line1";
				span.style.display = "block";
			var div = document.createElement("div");
				div.className = "iRadio_1";
				div.setAttribute("t","1");
				div.setAttribute("id","SSID_" + i);
				div.setAttribute("v",i);
				try{
					div.innerHTML = decodeURIComponent(wifi5g[n].SSID);
					wifi5g[n].SSID = decodeURIComponent(wifi5g[n].SSID);
					wifi5g[n].utf = 1;
				}catch(e){
					div.innerHTML = unescape(wifi5g[n].SSID);
					wifi5g[n].utf = 0;
				}
				
			if(wifi5g[n]["default"] == 1){
				div.setAttribute("class","iRadio_1 iRadio_elect");
				$("s1_0_passwd").value = wifi5g[n].passwd || "";
			}else{
				div.setAttribute("class","iRadio_1");
			}
			d.appendChild(div);
			d.appendChild(span);
		}
		return true;
	});
}
//设置5g
function set5GAp(pm){
	
	$.Ajax.post("/protocol.csp?fname=net&opt=wifi_5gclient&active=1&function=set",function(){
		$.msg.closeLoad();
		var domIndex = $("SSIDs").v;
		if(this.error){
			var error = this.error.code;
			$("SSID_" + domIndex).className = "iRadio_1 iRadio_error";
			if(error == "20103209"){
				$.msg.alert("::Setting_DDNS_Fail");
			}
			return;
		}else{
				getWiFiStatus(domIndex);
			}
	},pm);
}
//获取有线网络设置
var iWan = {};
function getWan() {
	$.Ajax.get("/protocol.csp?fname=net&opt=wifi_wan&function=get&encode=1" + wizardStr, function() {
		if(this.error) {
			this.showError();
			return;
		}
		iWan = $.xjson(this.responseXML, "wifi_wan", true);
		//填充 动态 静态 IP
		$.dom.on(iS2[iWan.mode], "vclick");
		if(iWan.ip){
			$("s2_2_ip").value = iWan.ip || "";
		}
		if(iWan.mask){
			$("s2_2_mask").value = iWan.mask || "";
		}
		if(iWan.gateway){
			$("s2_2_gateway").value = iWan.gateway || "";
		}

		if (iWan.mode == "0") {
			//静态设置
			$("s2_0_ip").value = iWan.ip || "";
			$("s2_0_mask").value = iWan.mask || "";
			$("s2_0_gateway").value = iWan.gateway || "";
			$("s2_0_DNS1").value = iWan.DNS1 || "";
			$("s2_0_DNS2").value = iWan.DNS2 || "";
		}
		else if (iWan.mode == "1") {
			//动态IP
			$("s2_1_ip").value = iWan.ip || "";
			$("s2_1_mask").value = iWan.mask || "";
			$("s2_1_gateway").value = iWan.gateway || "";
			$("s2_1_DNS1").value = iWan.DNS1 || "";
			$("s2_1_DNS2").value = iWan.DNS2 || "";
		}
		else if (iWan.mode == "2") {
			//PPPoE
			$("s2_2_user").value = decodeURIComponent(iWan.user) || "";
			$("s2_2_passwd").value = decodeURIComponent(iWan.passwd) || "";
			$("s2_2_servername").value = decodeURIComponent(iWan.servername) || "";
			$("s2_2_DNS1").value = iWan.DNS1 || "";
			$("s2_2_DNS2").value = iWan.DNS2 || "";
			iS2.getS2_2 = empty;
		}
	});
}

function checkIPError(dom, lge, isEmpty, reg) {
	var v = dom.value.trim();
	if (isEmpty && v == "") {
		return v;
	}
	if(v == ""){
		$.msg.alert(["::" + lge, "::Setting_DDNS_NotEmpty"]);
		return null;
	}
	if (!(reg || /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/).test(v)) {
		$.msg.alert(["::" + lge, "::Setting_Network_DHCPServer_error"]);
		return null;
	}
	return v;
}

function successGo(wd) {
	if(wd){
		//向导
		if(saveChange){
			$.msg.closeLoad();
		}

		//向导下一步
		$.wizard.next(true);
	}
	else {
		if(saveChange){
			//发送wifi生效协议
				$.msg.openLoad();
			$.Ajax.post("/protocol.csp?fname=net&opt=wifi_active&function=set" + saveChange, function () {
				$.msg.closeLoad();
				if(saveChange.indexOf("&active=wifi_client") > -1){
					getWiFiStatus(domS,1);
				}
				if(this.error) {
					this.showError();
				}else{
					//验证PPPoE是否联通
					if(iWan.mode == 2){	
						getInterNet($.lge.get("Setting_Network_Internet_M2_Status_0"),$.lge.get("Setting_Network_Internet_M2_Status_1"));
					}else{
						getWan();
					}
						
				}
			});
		}
	}
}

function saveSuccess(i, wd) {
	if(i == iMode){
		successGo(wd);
	}
	else {
		if(saveChange == ""){
			$.msg.openLoad();
		}
		saveChange += "&active=wifi_phymode";
		$.Ajax.post("/protocol.csp?fname=net&opt=wifi_phymode&function=set" + wizardStr, function () {
			$.msg.closeLoad();
			if(this.error){
				this.showError();
			}
			else{
				iMode = i;
				successGo(wd);
			}
		}, "mode=" + i);
	}
}
var domS;
function saveWifi(wd) {
	var pm = {};
	var m = iAps[$("SSIDs").v];
	var t = iAps[$("SSIDs").v]["t"];
	if(m == null){
		return ;
	}
	pm.SSID = m.SSID;
	pm.mac = m.mac;
	pm.passwd = $("s1_0_passwd").value.trim();
	pm.dhcp = $("S1_0").className == "iRadio_1 iRadio_elect" ? 0 : 1;
	if(pm.dhcp == 0){
		if((pm.ip = checkIPError($("s1_0_ip"), "Setting_Network_Internet_ip")) == null) {
			return;
		}
		if((pm.mask = checkIPError($("s1_0_mask"), "Setting_Network_Internet_mask", null, !/^(254|252|248|240|224|192|128|0)\.0\.0\.0|255\.(254|252|248|240|224|192|128|0)\.0\.0|255\.255\.(254|252|248|240|224|192|128|0)\.0|255\.255\.255\.(254|252|248|240|224|192|128|0)$/)) == null) {
			return;
		}
		if((pm.gateway = checkIPError($("s1_0_gateway"), "Setting_Network_Internet_gateway")) == null) {
			return;
		}
		if((pm.DNS1 = checkIPError($("s1_0_DNS1"), "Setting_Network_Internet_primary")) == null) {
			return;
		}
		if((pm.DNS2 = checkIPError($("s1_0_DNS2"), "Setting_Network_Internet_second", true)) == null) {
			return;
		}
	}
	var need;
	for(var n in pm) {
		//alert(n + "::" + pm[n] + "::" + iAp[n]);
		//编码
		//pm[n] = encodeURIComponent(pm[n]);
		if (pm[n] != (iAp[n] || "")) {
			need = true;
			break;
		}
	}
	//alert(need);
	if(need == null) {
		saveSuccess(3, wd);
		return;
	}
	if(saveChange == "") {
		$.msg.openLoad();
	}
	saveChange += "&active=wifi_client";
	getWiFiStatus($("SSIDs").v);
	pm.utf = m.utf;
	if(pm.utf == 0){
		pm.SSID = escape(pm.SSID);//转码
	}else{
		var re = /\\|%/;
		if(!re.test(pm.SSID) ){
			pm.SSID = decodeURIComponent(pm.SSID);//解密一次
		}
		
	}
	if(t){ //如果是5g就跳转5g
		set5GAp(pm);
		return;
	}
	$.Ajax.post("/protocol.csp?fname=net&opt=wifi_client&encode=1&function=set" + wizardStr, function (){
		$.msg.closeLoad();
		if(this.error) {
			this.showError();
		}
		else {
			iAp = pm;
			saveSuccess(3, wd);
			domS = $("SSIDs").v;
		}
	}, pm);
}
//重新获取状态
function getWiFiStatus(v,str){
	var t,d,status,dom = $("SSID_" + v);
	$.query("#SSIDs > div").attr("style", "");
	$.query("#SSIDs > div").attr("class", "iRadio_1");
	dom.className = "iRadio_1 iRadio_wait";
	dom.style.cssText = "";
	if(str){
		//防止多次进入
		clearInterval(t);
		clearTimeout(d);
	//成功：iRadio_1 iRadio_elect  
	//失败：iRadio_error 
	//等待：iRadio_wait
		//每2秒获取一次状态
		t = setInterval(function(){
			$.Ajax.get("/protocol.csp?fname=net&opt=wifi_linkstatus&function=get&t=" + new Date().getTime(),function(){
				status = $.xjson(this.responseXML, "status", true);
				if(status == 1){
					dom.className = "iRadio_1 iRadio_elect";
					dom.title = $.lge.get("Setting_DDNS_Success");
					clearTimeout(d);
					clearInterval(t);
				}
			});
		},2000);
		//10秒后清除计时器  
		var times = 10000;
	  if ($.config.themes == "public_wifidisk"){
		times = 40000;
	  }
		d = setTimeout(function(){
			clearInterval(t);
			clearTimeout(d);
			if(status != 1){
				dom.className = "iRadio_1 iRadio_error";
				dom.title = $.lge.get("Setting_DDNS_Fail");
			}
		},times);
	}
}
function saveWan(wd) {
	var pm = {},need;
	if(iS2.viewed == null){
		return ;
	}
//
//	if($("S2_0").className == "iRadio_1 iRadio_elect"){ m = 0; }
//	else if($("S2_1").className == "iRadio_1 iRadio_elect"){ m = 1; }
//	else if($("S2_2").className == "iRadio_1 iRadio_elect"){ m = 2; }
	pm.mode = iS2.viewed.id.replace(/^S2_/,"");
	if(pm.mode == 2){
		//pppoe
		var user = $("s2_2_user");
		pm.user = user.value.trim();
		if(pm.user == "") {
			return;
		}
		var passwd = $("s2_2_passwd");
		pm.passwd = passwd.value.trim();
		if(pm.passwd == "") {
			return;
		}
		pm.servername = $("s2_2_servername").value.trim();

		if((pm.DNS1 = checkIPError($("s2_2_DNS1"), "Setting_Network_Internet_primary", true)) == null) {
			return;
		}
		if((pm.DNS2 = checkIPError($("s2_2_DNS2"), "Setting_Network_Internet_second", true)) == null) {
			return;
		}
	}
	else{
		if(pm.mode == 0){
			if((pm.ip = checkIPError($("s2_0_ip"), "Setting_Network_Internet_ip")) == null) {
				return;
			}
			if((pm.mask = checkIPError($("s2_0_mask"), "Setting_Network_Internet_mask", null, !/^(254|252|248|240|224|192|128|0)\.0\.0\.0|255\.(254|252|248|240|224|192|128|0)\.0\.0|255\.255\.(254|252|248|240|224|192|128|0)\.0|255\.255\.255\.(254|252|248|240|224|192|128|0)$/)) == null) {
				return;
			}
			if((pm.gateway = checkIPError($("s2_0_gateway"), "Setting_Network_Internet_gateway")) == null) {
				return;
			}
			if((pm.DNS1 = checkIPError($("s2_0_DNS1"), "Setting_Network_Internet_primary")) == null) {
				return;
			}
			if((pm.DNS2 = checkIPError($("s2_0_DNS2"), "Setting_Network_Internet_second", true)) == null) {
				return;
			}
		}
	}

	for(var n in pm){
		//alert(pm[n] + "::" + iWan[n] || "");
		//编码
	//	pm[n] = encodeURIComponent(pm[n]);
		if(pm[n] != (iWan[n] || "")){
			need = true;
			break;
		}
	}
	if(need == null){
		saveSuccess(1, wd);
		return;
	}
	if(saveChange == ""){
		$.msg.openLoad();
	}
	saveChange += "&active=wifi_wan";
	$.Ajax.post("/protocol.csp?fname=net&opt=wifi_wan&encode=1&function=set" + wizardStr, function () {
		$.msg.closeLoad();
		if(this.error){
			this.showError();
		}
		else {
			iWan = pm;
			saveSuccess(1, wd);
		}
	}, pm);
}

var saveChange = "";
function save(wd) {
	saveChange = "";
	if ($("S0_1").className == "iRadio_2 iRadio_elect") {
		$("SSID_" + $("SSIDs").v).style.cssText = "";
		saveWifi(wd);
	}
	else if ($("S0_2").className == "iRadio_2 iRadio_elect") {
		saveWan(wd);
	}else if($("S0_3").className == "iRadio_2 iRadio_elect"){
		save3G(wd);
		}
}

//保存
$.vsubmit("submit", function () {
	save(isWizard);
	//getWan();
	return false;
});

$.dom.setScroll($("SSIDs"),$("SSIDs_rs"));
//3G
var i3G = {};
function get3G(fn){
	//获取3g
	$.Ajax.post("/protocol.csp?fname=net&opt=wifi_3g&function=get&encode=1" + wizardStr,function(){
		if(this.error){
				this.showError();
		}else{
			i3G = $.xjson(this.responseXML,"wifi_3g",true);
			$("3g-apn").value = decodeURIComponent(i3G.apn || "");
			//$("3g-pin").value = decodeURIComponent(i3G.pin || "");
			$("3g-number").value = decodeURIComponent(i3G.number || "");
			$("3g-user").value = decodeURIComponent(i3G.user || "");
			$("3g-passwd").value = decodeURIComponent(i3G.passwd || "");
		}
		if(i3G.status == "1"){
			$("3g_args").style.display = "none";
		}else{
			$("3g_args").style.display = "block";
		}
		$("3g-status").innerHTML = $.lge.get("Setting_Network_Internet_3G_Status_" + (i3G.status=="1"?"1":"0"));
		fn && fn();
	});
}

function save3G(wd){
	
	 successGo(wd);
	var pm = {};
	pm.apn = $("3g-apn").value.trim();
	//pm.pin = $("3g-pin").value.trim();
	pm.number =  $("3g-number").value.trim();
	pm.user = $("3g-user").value.trim();
	pm.passwd = $("3g-passwd").value.trim();

	var flag = false;
	for(var n in pm){
		if(pm[n] != (i3G[n] || "")){
			flag = true;
			break;
		}
	}
	if(flag){
		//保持3g
		$.msg.openLoad();
		$.Ajax.post("/protocol.csp?fname=net&opt=wifi_3g&encode=1&function=set" + wizardStr,function(){
			if(this.error){
				this.showError();
			}else{
				successGo(wd);	 
			}
		$.msg.closeLoad();
		},pm);
	}
	else{
		successGo(wd);
	}
}

function setNo3G(){
	switch(iMode){
		case 1:
			setMode("wan");
			break;
		case 3:
			setMode("wifi");
			break;
	}
}
	if($.config.has3G){
		$("S0_3").style.display = "block";
	}
	if($.config.hasRJ45){
		$("S0_2").style.display = "block";
	}
	//获取模式
	$.Ajax.get("/protocol.csp?fname=net&opt=wifi_phymode&function=get" + wizardStr, function () {
		if (this.error) {
			this.showError();
			return;
		}
		var x = $.xjson(this.responseXML, "wifi_phymode", true).mode;
		if(x == "1" && $.config.hasRJ45){//有线
			$("S0_2").style.display = "block";
			if ($.config.hasPPPoE) {
				$("S2_2").style.display = "block";
			}
			iMode = 1;
			$.dom.on(iS0.S0_2, "vclick");
		}else if(x == "2"){//3G
			if($.config.has3G){
				$("S0_3").style.display = "block";
				get3G(function(){
					$.query("#[S0_1,S0_2]").on("vclick", function (){});
					$("S0_1").style.color="#cccccc";
					$("S0_2").style.color="#cccccc";
					$("S0_3").className="iRadio_2 iRadio_elect";
					$("S0_3c").style.display = "block";
				});
			}else{
				iS0.getS0_3 = empty;
				$.query("#[S0_3]").on("vclick", function (){});
				$("S0_3").style.color="#cccccc";
			} 
				iMode = 2;
				$.dom.on(iS0.S0_3, "vclick");	
		}else{ //无线
			iMode = 3;
			$.dom.on(iS0.S0_1, "vclick");
		}
	});


//获取是否有自动切换网络功能
autoswitch = function(){
	autoswitch = function(){};
	$.Ajax.get("/protocol.csp?fname=service&opt=autoswitch&function=get",function(){
	if(!this.error){
	    v =  $.xjson(this.responseXML,"autoswitch",true);
	   if(v.enable == 1){
			var s1 = $("S0_1"),s2 = $("S0_2");
				if(s1.className.indexOf("iRadio_elect") == -1){
					s1.style.color = "#CCCCCC";
					$.dom.on(s1, "vclick",function(){
						return false;
					});
				}
				
				if(s2.className.indexOf("iRadio_elect") == -1){
					s2.style.color = "#CCCCCC";
					$.dom.on(s2, "vclick",function(){
						return false;
					});
				}
			//$.query("#[S0_1,S0_2]").on("vclick", function () {
			//	return false;
			//});
	   }
	}	
	});
};

if($.config.hasNetworkON_OFF){
	getInternetIsOFF();
	$("switch").style.display = "block";
}else{
	$("showInternet").style.display = "block";
	$("showInternet").style.marginTop = "0px";
}
$.dom.on($("internetView"), "vclick",function(){
	var v = this.className == "iSwitch_1" ? 0 : 1,pm = {};
	pm.internet_enable = v;
	setInternetIsOFF(pm);
});
function internetView(flag){
	var dom = $("internetView");
	flag = !!Number(flag);
	if(flag){
		dom.className = "iSwitch_1"
		$("showInternet").style.display = "block";
	}else{
	    dom.className = "iSwitch_1-0";
		$("showInternet").style.display = "none";
	}
}
//是否关闭互联网
//internetView
function getInternetIsOFF(){
	$.msg.openLoad();
	$.Ajax.get("/protocol.csp?fname=net&opt=internet_enable_handle&function=get",function(){
		$.msg.closeLoad();
		if(!this.error){
			v = $.xjson(this.responseXML,"internet_enable",true);
			internetView(v);
		}
	});
}

function setInternetIsOFF(pm){
	if(pm == null){return false;}
		$.msg.openLoad();
	$.Ajax.post("/protocol.csp?fname=net&opt=internet_enable_handle&function=set",function(){
		$.msg.closeLoad();
		if(!this.error){
			v =  $.xjson(this.responseXML,"internet_enable",true);
			internetView(v);
		}
	},pm);
	
}
