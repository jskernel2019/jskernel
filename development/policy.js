jskernel_policy={
	"main":{
		//CVE-2017-7843 block indexedDB API
		"indexedDB":{
			"get":function(){}
		},
		//CVE-2014-1487 sanitize the onerror function
		"onerror":{
			"func":function(e){
				if(typeof e == "string"){
					let words = e.split(" ");
					let res = "";
					for(let i in words){
						if(words[i].substring(0,8) == "https://" || words[i].substring(0,7) == "http://")res += "sanitized url ";
						else res += words[i] + " ";
					}
					return jskernel.onerror(e);
				}
				else return jskernel.onerror(e);
			}
		},
		"jskernel_worker_onmessage_policy":{
			"func":function(e) {
				//CVE-2018-5092 close a worker if it's freed after calling fetch
				if(e.data == `fetch_begin`){
					worker.postMessage(`fetch_confirm`);
					worker.alive = false;
					setTimeout(function(){ 
							worker.postMessage(`check_alive`);
							setTimeout(function(){
									if(!worker.alive){worker.terminate();}
									},
									1);
							},
							5);
				}
				if(e.data == `alive`){worker.alive = true;}
				//CVE-2014-1488 disable worker.terminate once an ArrayBuffer created.
				if(e.data == "ArrayBuffer created"){
					worker.teminate = function(){}
				}
			}
		},
		//CVE-2013-5602 avoid null worker.onmessage
		"Worker":{
			"prototype":{
				"onmessage":{
					"get":()=>{return this["jskernel_onmessage"]},
					"set":(func)=>{
						if(func === null)return;
						this["jskernel_onmessage"] = func;
					}
				}
			}
		}
	},
	"worker":{
		"indexedDB":{
			"get":function(){}
		},
		"fetch":{
			"func":function(){
				let url = arguments[0];
				let opt = arguments[1];
				self.postMessage(`fetch_begin`);
				self[`fetch_flag`] = false;
				let fetch_stub_func = function(resolve, reject){
					if(self[`fetch_flag`]){
						return old_fetch(url, opt);
					}else{
						setTimeout(fetch_stub_func, 1, resolve, reject);
					}
				};
				let fetch_stub =  new Promise(fetch_stub_func);
				return fetch_stub;
			}
		},
		"jskernel_onmessage_policy":{
			"func":function(e) {
				if(e.data == `fetch_confirm`){
					console.log(`fetch_confirm in worker`);
					self[`fetch_flag`] = true;
				}
				if(e.data == `check_alive`){
					self.postMessage(`alive`);
				}
			}
		},
		//CVE-2014-1488
		"ArrayBuffer":{
			"func":{
				postMessage("ArrayBuffer created");
				return jskernel.ArrayBuffer();

			}
		},
		//CVE-2013-1714
		"XMLHttpRequest":{
			"prototype":{
				"open":{
					"func":function(method, url, flag){
						if(url.substring(0, 7) == "http://"){
							url = url.substring(7, url.length);
							url = url.substring(0, url.indexOf('/'));
							url = "http://" + url;
						}
						if(url.substring(0, 8) == "https://"){
							url = url.substring(8, url.length);
							url = url.substring(0, url.indexOf('/'));
							url = "http://" + url;
						}
						if(url != self.location.origin){
							console.log(url, self.location.origin);
							console.log("request for cross-origin resources!!!");
							return;
						}
						console.log(jskernel.XMLHttpRequest.prototype);
						console.log(this, method, url, flag);
						return jskernel.XMLHttpRequest.prototype.open.apply(this, [method, url, flag]);

					}
				}
			}
		}
	}
}
