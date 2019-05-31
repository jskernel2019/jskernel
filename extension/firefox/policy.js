jskernel_policy={
	"main":{
		"indexedDB":{
			"get":function(){}
		},
		"jskernel_worker_onmessage_policy":{
			"func":function(e) {
				if(e.data == `fetch_begin`){
					worker.postMessage(`fetch_confirm`);
					worker.alive = false;
					setTimeout(function(){ 
							worker.postMessage(`check_alive`);
							setTimeout(function(){
									if(!worker.alive){worker.terminate();}
									},1);
							},5);
				}
				if(e.data == `alive`){worker.alive = true;}
			}
		}
	},
	"worker":{
		"indexedDB":{
			"get":function(){}
		},
		"test_func":{
			"func":function(){}
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
		}
	}
}
