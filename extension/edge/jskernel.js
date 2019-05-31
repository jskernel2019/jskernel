jskernel_text = `
(function () {

	class jskernel_element {

		constructor(priority, func, context, params, flag) {
			this.endTime = priority;
			this.context = context;
			this.func = func;
			this.params = params;
			this.flag = flag;
			this.finish = false;
		}

		toString() {
			return "(" + this.endTime + "," + this.context + "," + this.func + ",[[" + this.params + "]]," + this.flag + "," + this.finish + ")";
		}

	}

	class jskernel_pq {

		constructor() {
			this.data = [];
		}

		push(element) {
			let i = 0;
			// Get the index of the first element in the queue with priority greater than the one given
			for (; i < this.data.length && this.data[i].endTime < element.endTime; i++);

			// If flag of element to insert is 1, insert the element before
			if (element.flag === 1) {
				this.data.splice(i, 0, element);
				return;
			}

			// Get index of first element that has a greater priority, OR same priority with flag 1 (whichever comes first)
			for (; i < this.data.length && this.data[i].endTime === element.endTime && this.data[i].flag === 0; i++);

			this.data.splice(i, 0, element);
		}

		pop() {
			if (this.size() > 0) return this.data.shift();
		}

		top() {
			return this.data[0];
		}

		size() {
			return this.data.length;
		}

		toString() {
			let res = "";
			for (let i = 0; i < this.data.length; i++) {
				res += this.data[i].toString() + ";";
			}
			return res;
		}

	}

	// Our global counter variable
	let _jskernel_counter_ = 0;

        try{
	    shared_counter_buffer = new SharedArrayBuffer(16);
	    shared_counter = new Float32Array(shared_counter_buffer);
        }catch(err){
            console.log("SharedArrayBuffer no defined");
            shared_counter_buffer = {};
            shared_counter = {};
        }

	// Create our queue
	var __event_queue__ = new jskernel_pq();

	let enable_recover_clock = true;


	// Push an element of flag 1 to the queue that will block queue execution when at the head. 
	// Also, push an empty element with a priority of the current timestamp and a flag of 2 to the queue.
	// Therefore, every time this function is called, the counter is incremented.

	var __event_begin__ = function (eet, cb, context, params) {
		if (typeof eet != "number") {
			return;
		}
		let endTime = _jskernel_counter_ + eet;
		let e = new jskernel_element(endTime, cb, context, params, 1);
		__event_queue__.push(e);
		return e;
	}

	var __event_insert__ = function (endTime, cb, context, params) {
		if (typeof endTime != "number") {
			return;
		}
		let e = new jskernel_element(endTime, cb, context, params, 0);
		__event_queue__.push(e);
		__jskernel_dispatch__(0);
	}

	let __add_recover_clock_event__ = function () {
		let e = new jskernel_element(parseInt(old_performance.call(performance)) - jskernel_performance_base, null, null, null, 2);
		if(enable_recover_clock)__event_queue__.push(e);
	}

	let __recover_clock_status__ = {};
	let __recover_clock_id__ = 0;
	var __recover_clock_acq__ = function(recover_clock_event){
		if(jskernel_workers.length == 0){
			if (recover_clock_event.endTime > _jskernel_counter_ && __event_queue__.size() == 0) {
				_jskernel_counter_ = recover_clock_event.endTime;
				shared_counter[0] = recover_clock_event.endTime;
				return;
			}
		} 
		let tmp = __recover_clock_id__;
		__recover_clock_id__++;
		__recover_clock_status__[tmp] = [jskernel_workers.length,recover_clock_event];
		for(let i = 0; i < jskernel_workers.length; i++){
			jskernel_workers[i].postMessage({
				jskernel_topic: '_jskernel_recover_clock_',
				jskernel_buf: tmp
			});
		}
	}

	var __recover_clock_ack__ = function(id){
		if(id in __recover_clock_status__){
			__recover_clock_status__[id][0]--;
			if(__recover_clock_status__[id][0] == 0){
				_jskernel_counter_ = __recover_clock_status__[id][1].endTime;
				shared_counter[0] = __recover_clock_status__[id][1].endTime;
			}
		}
	}

	//setTimeout(function(){enable_recover_clock = true;},5000);


	// Push an element of flag 0 to the queue that will be ran immediately when at the head of the queue.

	var __event_end__ = function (event) {
		event.flag = 0;
		__jskernel_dispatch__(0);
	}

	var __jskernel_dispatch__ = function (flag) {
		__add_recover_clock_event__();

		while (__event_queue__.size() > 0) {
			if (__event_queue__.top().flag == 1 && __event_queue__.top().finish == false && flag != 1) break;

			let e = __event_queue__.pop();

			if (e.flag === 1) {
				if (e.endTime > _jskernel_counter_) _jskernel_counter_ = e.endTime;
			}
			// If the first element has flag 0, pop and run the callback, and assign counter to its priority
			else if (e.flag === 0) {
				_jskernel_counter_ = e.endTime;
				shared_counter[0] = e.endTime;

				if (e.func != null && e.finish == false && typeof e.func === 'function' && typeof e.func.apply !== 'undefined') {
					e.finish = true;
					try {
						e.func.apply(e.context, e.params);
					} catch (err) {
						console.log(err);
					}
				}
			}
			// If first element has flag 2, it is simply a timestamp to move our counter forward
			else if (e.flag === 2) {
				__recover_clock_acq__(e);
				/*if (e.endTime > _jskernel_counter_ && __event_queue__.size() == 0) {
				//if (__event_queue__.size() == 0) {
					_jskernel_counter_ = e.endTime;
					
				}*/
			}
			// Otherwise, if dispatch was called with flag 2, pop the first element. Otherwise, break.
			else {}

		}


	}

	// Override for the performance.now function - increments and returns our counter
	let jskernel_performance_origin = performance.timeOrigin;
	let jskernel_performance_base = performance.now();
	let old_performance = performance.now;
	performance.now = function () {
		__jskernel_dispatch__(0);
		let tmp_counter = _jskernel_counter_;
		_jskernel_counter_ += 1;
		return jskernel_performance_base + tmp_counter;
	}

	// Override for the performance.now function - increments and returns our counter
	let jskernel_date_base = Date.now();
	let old_Date_now = Date.now;
	Date.now = function () {
		_jskernel_counter_ += 1;
		return jskernel_date_base + _jskernel_counter_;
	}

	let jskernel_setTimeout_event = {};
	// Override setTimeout to, after the delay specified, push the callback given to our queue
	let old_setTimeout = setTimeout;
	setTimeout = function () {
		let cb = arguments[0];
		let delay = arguments[1];
		let params = Array.prototype.slice.call(arguments);
		if (typeof delay != "number" || delay < 0) delay = 0;
		let jskernel_event = __event_begin__(delay, cb, null, params);
		let jskernel_cb = function () {
			__event_end__(jskernel_event);
		}
		params[0] = jskernel_cb;
		let id = old_setTimeout.apply(null, params);
		jskernel_setTimeout_event[id] = jskernel_event;
		old_setTimeout(__event_end__, delay + 5 ,jskernel_event);
		return id;
	}

	let old_clearTimeout = clearTimeout;
	clearTimeout = function () {
		let params = Array.prototype.slice.call(arguments);
		let id = params[0];
		if (id in jskernel_setTimeout_event) {
			jskernel_setTimeout_event[id].finish = true;
		}
		return old_clearTimeout.apply(null, params);
	}

	let old_setInterval = setInterval;
	let setInterval_id = 0;
	let setInterval_id_map = {};
	setInterval = function () {
		let cb = arguments[0];
		let delay = arguments[1];
		let jskernel_cb = function () {
			let params = Array.prototype.slice.call(arguments);
			cb.apply(null, params);
			params.unshift(delay);
			params.unshift(cb);
			setInterval_id_map[setInterval_id] = setInterval.apply(null, params);
		}
		let params = Array.prototype.slice.call(arguments);
		params[0] = jskernel_cb;
		let id = setTimeout.apply(null, params);
		let tmp_id = setInterval_id;
		setInterval_id_map[tmp_id] = id;
		setInterval_id += 1;
		return id;
	}

	let old_clearInterval = clearInterval;
	clearInterval = function () {
		let params = Array.prototype.slice.call(arguments);
		let id = params[0];
		return clearTimeout(id);
	}

	let next_window_onerror = null;
	let next_window_onerror_params = null;
	let have_next_window_onerror = false;
	let old_windowonerror = window.onerror;
	window.onerror = function () {
		if (arguments[0] == "Uncaught SyntaxError: Unexpected identifier" || arguments[0] == "Script error.") {
			next_window_onerror = function () {
				old_windowonerror.apply(window, next_window_onerror_params);
			}
			next_window_onerror_params = Array.prototype.slice.call(arguments);
			have_next_window_onerror = true;
		} else {
			if (old_windowonerror != null) old_windowonerror.apply(window, Array.prototype.slice.call(arguments));
		}
	}

	Object.defineProperty(window, 'onerror', {
		set: function (e) {
			old_windowonerror = e;

		}
	});

	// Override the Element.appendChild function to safely execute for typical targets of attacks:
	// appending images and script elements to a page
	let old_appendChild = Element.prototype.appendChild;
	Element.prototype.appendChild = function () {

		if (arguments[0].tagName == 'DIV'){

			let target = arguments[0];
			
			target.old_animationstart = null;
			let animationstart = function(){
				let params = Array.prototype.slice.call(arguments);
				target.animation_jskernel_event = __event_begin__(0, null, null, null);
				old_setTimeout(
					function(e){
						if(!target.animation_jskernel_event.finish)__event_end__(e)
					}, 3000, target.animation_jskernel_event);
				
				if(target.old_animationstart != null)return target.old_animationstart.apply(target, params);
			}
			arguments[0].addEventListener("webkitAnimationStart",animationstart);
			arguments[0].addEventListener("animationstart",animationstart);

			/*Object.defineProperty(arguments[0], 'onwebkitanimationstart', {
				set: function (e) {
					arguments[0].old_animationstart = e;
				}
			});
			Object.defineProperty(arguments[0], 'onanimationstart', {
				set: function (e) {
					arguments[0].old_animationstart = e;
				}
			});*/

			target.old_animationend = null;
			let animationend = function(){
				console.log("here");
				console.log(target.old_animationend);
				let params = Array.prototype.slice.call(arguments);
				__event_end__(target.animation_jskernel_event);
				if(target.old_animationstart != null)return target.old_animationend.apply(target, params);
			}
			arguments[0].addEventListener("webkitAnimationEnd",animationend, arguments[0]);
			arguments[0].addEventListener("animationend",animationend, arguments[0]);

			/*Object.defineProperty(arguments[0], 'onwebkitanimationend', {
				set: function (e) {
					arguments[0].old_animationend = e;
				}
			});
			Object.defineProperty(arguments[0], 'onanimationend', {
				set: function (e) {
					arguments[0].old_animationend = e;
				}
			});*/

		}

		// If the element being appended is not of concern, do it the old way
		if (arguments[0].tagName != 'SCRIPT' && arguments[0].tagName != 'IMG') {
			return old_appendChild.apply(this, arguments);
		}

		// Average duration to append an element to the page we want to show every time
		let avgDuration = 10;

		// Append the blocking element with flag 1 to the queue
		arguments[0].jskernel_event = __event_begin__(avgDuration, null, null, null);
		//arguments[0].jskernel_event = new jskernel_element( _jskernel_counter_ + avgDuration, null, arguments[0], null, 0);
		//arguments[0].jskernel_event.finish = true;
		old_setTimeout(function () {
			arguments[0].jskernel_event.finish = true;
		}, 1000, arguments[0]);

		arguments[0].old_onload_handler = arguments[0].onload;

		// Override what to do when the element loads on the page
		arguments[0].onload = function () {
			this.jskernel_event.func = this.old_onload_handler;
			this.jskernel_event.context = this;
			this.jskernel_event.params = Array.prototype.slice.call(arguments);
			if (this.jskernel_event.finish == false) __event_end__(this.jskernel_event);
			else __event_insert__(this.jskernel_event.endTime, this.jskernel_event.func, this.jskernel_event.context, this.jskernel_event.params);
			if (this.tagName == 'SCRIPT' && have_next_window_onerror) {
				have_next_window_onerror = false;
				__event_insert__(this.jskernel_event.endTime, next_window_onerror, window, null);
			}
		}

		try{
		Object.defineProperty(arguments[0], 'onload', {
			set: function (e) {
				this.old_onload_handler = e;

			}
		});
		}
		catch(e){}

		arguments[0].old_onerror_handler = arguments[0].onerror;

		arguments[0].onerror = function () {
			this.jskernel_event.func = this.old_onerror_handler;
			this.jskernel_event.context = this;
			this.jskernel_event.params = Array.prototype.slice.call(arguments);
			if (this.jskernel_event.finish == false) __event_end__(this.jskernel_event);
			else __event_insert__(this.jskernel_event.endTime, this.jskernel_event.func, this.jskernel_event.context, this.jskernel_event.params);
		}

		try{
		Object.defineProperty(arguments[0], 'onerror', {
			set: function (e) {
				this.old_onerror_handler = e;
			}
		});
		} catch(e) {}


		return old_appendChild.apply(this, arguments);
	}

	let video_start_time = {}
	let hook_video = function(video){
		if(typeof video.jskernel_play_hook == 'undefined'){
			video_start_time[video] = null;
			video.old_play = video.play;
			video.play = function(){
				let params = Array.prototype.slice.call(arguments);
				video_start_time[video] = jskernel_performance_base + _jskernel_counter_;
				//console.log("play", video_start_time[video]);
				return video.old_play.apply(video, params);
			}
			video.jskernel_play_hook = true;
		}
		if(typeof video.jskernel_ac_hook == 'undefined'){
			if(video.textTracks.length == 0)return;
			for(i=0; i < video.textTracks.length; i++){
				track = video.textTracks[i];
				old_object_defineProperty(track, "activeCues", {
					get: function(){
					        let start = video_start_time[video];
						let current = jskernel_performance_base + _jskernel_counter_;
						console.log("activeCues",start,current,current - start);
						play_time = (current - start) / 1000;
						//console.log(start, current, play_time);
						//console.log(track.cues[0]);
						for(k = 0; k < track.cues.length; k++){
							if(track.cues[k].startTime <= play_time && track.cues[k].endTime >= play_time)return [track.cues[k]];
						}
						return null;
					}
				});
			}
			video.jskernel_ac_hook = true;
		}
	}

	let old_document_getElementById = document.getElementById;
	//let got_element = [];
	document.getElementById = function() {
		let params = Array.prototype.slice.call(arguments);
		res = old_document_getElementById.apply(document, params);
		if(res.tagName == "VIDEO"){
			hook_video(res);
		}
		return res;
	}

	let __jskernel_old_requestAnimationFrame__ = requestAnimationFrame;
	let __jskernel_requestAnimationFrame_map__ = {};
	requestAnimationFrame = function (cb) {
		let time = 20;
		let jskernel_event = __event_begin__(time, cb, null, [performance.now()]);
		let __jskernel_cb__ = function () {
			__event_end__(jskernel_event);
		}


		let id = __jskernel_old_requestAnimationFrame__(__jskernel_cb__);
		//let id = __jskernel_old_requestAnimationFrame__(cb);
		__jskernel_requestAnimationFrame_map__[id] = jskernel_event;
		old_setTimeout(__event_end__, 20, jskernel_event);
		return id;
	}

	let __jskernel_old_cancelAnimationFrame__ = cancelAnimationFrame;
	cancelAnimationFrame = function (requestID) {
		if(requestID in __jskernel_requestAnimationFrame_map__){
			__jskernel_requestAnimationFrame_map__[requestID].flag = 0;
			__jskernel_requestAnimationFrame_map__[requestID].finish = true;
		}
		return __jskernel_old_cancelAnimationFrame__(requestID);
	}

	let __jskernel_old_postMessage__ = window.postMessage;
	let __jskernel_postMessage_map__ = {};
	window.postMessage = function () {
		let params = Array.prototype.slice.call(arguments);
		let jskernel_event = __event_begin__(10, null, null, null);
		__jskernel_postMessage_map__[params[0]] = jskernel_event;
		__jskernel_old_postMessage__.apply(window, params);
		old_setTimeout(__event_end__, 5, jskernel_event);
	}

	let __jskernel_old_window_onmessage__ = window.onmessage;
	window.onmessage = function () {
		let params = Array.prototype.slice.call(arguments);
		let msg = params[0].data;
		if (params[0].source == params[0].target && msg in __jskernel_postMessage_map__) {
			let jskernel_event = __jskernel_postMessage_map__[msg];
			jskernel_event.func = __jskernel_old_window_onmessage__;
			jskernel_event.context = window;
			let tmp_timeStamp = jskernel_event.endTime;
			let onmessage_event_handler = {
				get: (obj, prop) => {
					return prop == 'timeStamp' ? tmp_timeStamp : obj[prop];
				}
			};
			let jskernel_onmessage_event = new Proxy(params[0], onmessage_event_handler);
			jskernel_event.params = [jskernel_onmessage_event];
			__event_end__(jskernel_event);
		} else {
			__event_insert__(_jskernel_counter_ + 100, __jskernel_old_window_onmessage__, window, params);
		}
	}

	Object.defineProperty(window, 'onmessage', {
		set: function (e) {
			__jskernel_old_window_onmessage__ = e;

		}
	});


	let old_object_defineProperty = Object.defineProperty;
	Object.defineProperty = function(obj, prop, val){
		//let params = Array.prototype.slice.call(arguments);
		//console.log(params);
		//if(obj == window && "set" in val && (prop == 'onmessage' || prop == 'onerror'))delete val["set"];
		if(obj == window && "set" in val && (prop == 'onmessage' || prop == 'onerror'))return window;
		//console.log(obj, prop, val);
 		res = old_object_defineProperty(obj, prop, val);
		//console.log(res);
		return res;
		//old_object_defineProperty.apply(Object, params);
	}

        try{	
	    let old_atomics_add = Atomics.add;
	    Atomics.add = function(){
		let params = Array.prototype.slice.call(arguments);
		let eet = shared_counter[1] + 1;
		shared_counter[1] = eet;
		let jskernel_event = __event_insert__(eet, old_atomics_add, null, params);
	    }
        }catch(err){}

	let old_Uint32Array = Uint32Array;
	/*Uint32Array = function(buffer){
		real_array = new old_Uint32Array(buffer);
		var handler = {
    			set: function(obj, prop, val) {
				let eet = shared_counter[1] + 2;
				shared_counter[1] = eet;
				let jskernel_event = __event_insert__(eet, function(){obj[prop]=val;}, null, null);
				return true;
    			},
			get: function(obj, prop) {
				return obj[prop];
			}
		};
		return new Proxy(real_array, handler);
	}*/

	var worker_inject_script = function () {

		kernelWorkerInterface = (function () {

			class jskernel_element {

				constructor(priority, func, context, params, flag) {
					this.endTime = priority;
					this.context = context;
					this.func = func;
					this.params = params;
					this.flag = flag;
					this.finish = false;
				}

				toString() {
					return "(" + this.endTime + "," + this.context + "," + this.func + ",[[" + this.params + "]]," + this.flag + "," + this.finish + ")";
				}

			}

			class jskernel_pq {

				constructor() {
					this.data = [];
				}

				push(element) {
					let i = 0;
					// Get the index of the first element in the queue with priority greater than the one given
					for (; i < this.data.length && this.data[i].endTime < element.endTime; i++);

					// If flag of element to insert is 1, insert the element before
					if (element.flag === 1) {
						this.data.splice(i, 0, element);
						return;
					}

					// Get index of first element that has a greater priority, OR same priority with flag 1 (whichever comes first)
					for (; i < this.data.length && this.data[i].endTime === element.endTime && this.data[i].flag === 0; i++);

					this.data.splice(i, 0, element);
				}

				pop() {
					if (this.size() > 0) return this.data.shift();
				}

				top() {
					return this.data[0];
				}

				size() {
					return this.data.length;
				}

				toString() {
					let res = "";
					for (let i = 0; i < this.data.length; i++) {
						res += this.data[i].toString() + ";";
					}
					return res;
				}

			}

			// Our global counter variable
			let _jskernel_counter_ = 0;
			var shared_counter = [0,0,0,0];

			// Create our queue
			var __event_queue__ = new jskernel_pq();


			// Push an element of flag 1 to the queue that will block queue execution when at the head. 
			// Also, push an empty element with a priority of the current timestamp and a flag of 2 to the queue.
			// Therefore, every time this function is called, the counter is incremented.

			var __event_begin__ = function (eet, cb, context, params) {
				if (typeof eet != "number") {
					return;
				}
				let endTime = _jskernel_counter_ + eet;
				let e = new jskernel_element(endTime, cb, context, params, 1);
				__event_queue__.push(e);
				return e;
			}

			var __event_insert__ = function (endTime, cb, context, params) {
				if (typeof endTime != "number") {
					return;
				}
				let e = new jskernel_element(endTime, cb, context, params, 0);
				__event_queue__.push(e);
				__jskernel_dispatch__(0);
			}

			let __add_recover_clock_event__ = function () {
				let e = new jskernel_element(parseInt(old_performance.call(performance)) - Math.floor(jskernel_performance_base), null, null, null, 2);
				//__event_queue__.push(e);
			}


			// Push an element of flag 0 to the queue that will be ran immediately when at the head of the queue.
			// Note: This may be used to replace an element previously inserted with flag 1.

			var __event_end__ = function (event) {
				event.flag = 0;
				__jskernel_dispatch__(0);
			}

			var __jskernel_dispatch__ = function (flag) {
				//__add_recover_clock_event__();

				while (__event_queue__.size() > 0) {
					if (__event_queue__.top().endTime > shared_counter[0]){
						break;
					}
					if (__event_queue__.top().flag == 1 && __event_queue__.top().finish == false){
						//old_setTimeout(function(e){e.finish=true;}, 5, __event_queue__.top());
						__event_queue__.top().finish = true;
						break;
					}

					let e = __event_queue__.pop();

					if (e.flag === 1) {
						if (e.endTime > _jskernel_counter_) _jskernel_counter_ = e.endTime;
					}
					// If the first element has flag 0, pop and run the callback, and assign counter to its priority
					else if (e.flag === 0) {
						_jskernel_counter_ = e.endTime;

						if (e.func != null && e.finish == false && typeof e.func === 'function' && typeof e.func.apply !== 'undefined') {
							e.finish = true;
							try {
								e.func.apply(e.context, e.params);
							} catch (err) {
								//console.log(err);
							}
						}
					}
					// If first element has flag 2, it is simply a timestamp to move our counter forward
					else if (e.flag === 2) {
						if (e.endTime > _jskernel_counter_ && __event_queue__.size() == 0) {
							_jskernel_counter_ = e.endTime;
						}
					}
					// Otherwise, if dispatch was called with flag 2, pop the first element. Otherwise, break.
					else {}

				}

			}

			// Override for the performance.now function - increments and returns our counter
			let jskernel_performance_origin = performance.timeOrigin;
			let jskernel_performance_base = performance.now();
			let old_performance = performance.now;
			performance.now = function () {
				__jskernel_dispatch__(0);
				let tmp_counter = _jskernel_counter_;
				_jskernel_counter_ += 1;
				return jskernel_performance_base + tmp_counter;
			}

			// Override for the performance.now function - increments and returns our counter
			let jskernel_date_base = Date.now();
			let old_Date_now = Date.now;
			Date.now = function () {
				_jskernel_counter_ += 1;
				return jskernel_date_base + _jskernel_counter_;
			}

			let jskernel_setTimeout_event = {};
			// Override setTimeout to, after the delay specified, push the callback given to our queue
			let old_setTimeout = setTimeout;
			setTimeout = function () {
				let cb = arguments[0];
				let delay = arguments[1];
				let params = Array.prototype.slice.call(arguments);
				if (typeof delay != "number" || delay < 0) delay = 0;
				let jskernel_event = __event_begin__(delay, cb, null, params);
				let jskernel_cb = function () {
					__event_end__(jskernel_event);
				}
				params[0] = jskernel_cb;
				let id = old_setTimeout.apply(null, params);
				jskernel_setTimeout_event[id] = jskernel_event;
				old_setTimeout(__event_end__, delay, jskernel_event);
				return id;
			}

			let old_clearTimeout = clearTimeout;
			clearTimeout = function () {
				let params = Array.prototype.slice.call(arguments);
				let id = params[0];
				if (id in jskernel_setTimeout_event) {
					jskernel_setTimeout_event[id].finish = true;
				}
				return old_clearTimeout.apply(null, params);
			}

			let old_setInterval = setInterval;
			let setInterval_id = 0;
			let setInterval_id_map = {};
			setInterval = function () {
				let cb = arguments[0];
				let delay = arguments[1];
				let jskernel_cb = function () {
					let params = Array.prototype.slice.call(arguments);
					cb.apply(null, params);
					params.unshift(delay);
					params.unshift(cb);
					setInterval_id_map[setInterval_id] = setInterval.apply(null, params);
				}
				let params = Array.prototype.slice.call(arguments);
				params[0] = jskernel_cb;
				let id = setTimeout.apply(null, params);
				let tmp_id = setInterval_id;
				setInterval_id_map[tmp_id] = id;
				setInterval_id += 1;
				return id;
			}

			let old_clearInterval = clearInterval;
			clearInterval = function () {
				let params = Array.prototype.slice.call(arguments);
				let id = params[0];
				return clearTimeout(id);
			}

			let __jskernel_old_postMessage__ = self.postMessage;
			let __jskernel_postMessage_map__ = {};
			self.postMessage = function () {
				let params = Array.prototype.slice.call(arguments);
				let jskernel_event = __event_begin__(5, null, null, null);
				//__jskernel_postMessage_map__[params[0]] = jskernel_event;
				//let e = new jskernel_element(_jskernel_counter_ + 10, null, null, null, 1);
				//__jskernel_old_postMessage__.apply(this, [{
				//	jskernel_topic: '_jskernel_postmessage_event_',
				//	jskernel_postmessage_msg: params[0],
				//	jskernel_buf: e
				//}]);
				__jskernel_old_postMessage__.apply(self, params);
				old_setTimeout(__event_end__, 5, jskernel_event);
			}

			var __jskernel_old_this_onmessage__ = null;
                        //var jskernel_onmessage_policy = function(){}
			self.onmessage = function () {
				__jskernel_dispatch__(0);
				let params = Array.prototype.slice.call(arguments);
                                if(typeof jskernel_onmessage_policy === "function")jskernel_onmessage_policy(params[0]);
				if (typeof params[0].data ==='object' && "jskernel_topic" in params[0].data) {
					if (params[0].data.jskernel_topic == "_jskernel_postmessage_event_") {
						let e = params[0].data.jskernel_buf;
						let msg = params[0].data.jskernel_postmessage_msg;
						__jskernel_postMessage_map__[msg] = e;
						__event_queue__.push(e);
						old_setTimeout(__event_end__, 20, e);
					} else if (params[0].data.jskernel_topic == "_jskernel_init_") {
						jskernel_performance_base = params[0].data.jskernel_buf[0];
						let shared_counter_buffer = params[0].data.jskernel_buf[1];
						shared_counter = new Float32Array(shared_counter_buffer);
					} else if (params[0].data.jskernel_topic == "_jskernel_recover_clock_") {
						recover_clock_event_id = params[0].data.jskernel_buf;
						if(__event_queue__.size() == 0){
							__jskernel_old_postMessage__({
								jskernel_topic: '_jskernel_recover_clock_',
								jskernel_buf: recover_clock_event_id
							});
						}
					}
					return;
				}
				let msg = params[0].data;
				if (msg in __jskernel_postMessage_map__ && __jskernel_postMessage_map__[msg].finish == false && __jskernel_postMessage_map__[msg].flag == 1) {
					let jskernel_event = __jskernel_postMessage_map__[msg];
					jskernel_event.func = __jskernel_old_this_onmessage__;
					jskernel_event.context = self;
					let tmp_timeStamp = jskernel_event.endTime;
					let onmessage_event_handler = {
						get: (obj, prop) => {
							return prop == 'timeStamp' ? tmp_timeStamp : obj[prop];
						}
					};
					let jskernel_onmessage_event = new Proxy(params[0], onmessage_event_handler);
					jskernel_event.params = [jskernel_onmessage_event];
					__event_end__(jskernel_event);
				} else {
					__event_insert__(_jskernel_counter_ + 10, __jskernel_old_this_onmessage__, this, params);
				}
			}

			Object.defineProperty(self, 'onmessage', {
				set: function (e) {
					__jskernel_old_this_onmessage__ = e;

				}
			});

	
                        try{
			let old_atomics_add = Atomics.add;
			Atomics.add = function(){
				let params = Array.prototype.slice.call(arguments);
				let eet = shared_counter[1] + 1;
				shared_counter[1] = eet;
				//console.log("fafaew", shared_counter);
				let jskernel_event = __event_insert__(eet, old_atomics_add, null, params);
			}
                        }catch(err){}

			let old_Uint32Array = Uint32Array;
			Uint32Array = function(buffer){
				real_array = new old_Uint32Array(buffer);
				var handler = {
    					set: function(obj, prop, val) {
						let eet = shared_counter[1] + 2;
						shared_counter[1] = eet;
						let jskernel_event = __event_insert__(eet, function(){obj[prop]=val;}, null, null);
						return true;
    					}
				};
				return new Proxy(real_array, handler);
			}

			return {
				src: "user worker file here",
				dir: "user dir here",
				domain: "user domain here",
			};

		})();

		//console.log(kernelWorkerInterface.src);
		//console.log(kernelWorkerInterface.dir);
		//console.log(kernelWorkerInterface.domain);
		try {
			console.log('kernelWorkerInterface.src');
			console.log(kernelWorkerInterface.src);
			importScripts(kernelWorkerInterface.src);
		} catch (err) {
			try{
				if(kernelWorkerInterface.src.charAt(0) == '/'){
					//console.log('kernelWorkerInterface.domain + kernelWorkerInterface.src');
					//console.log(kernelWorkerInterface.domain + kernelWorkerInterface.src);
					importScripts(kernelWorkerInterface.domain + kernelWorkerInterface.src);
				}
				else{
					//console.log('kernelWorkerInterface.dir' + '/' + 'kernelWorkerInterface.src');
					//console.log(kernelWorkerInterface.dir + '/' + kernelWorkerInterface.src);
					importScripts(kernelWorkerInterface.dir + '/' + kernelWorkerInterface.src);
				}
			} catch (err) { 
                                console.log(err);
				console.log("can't load worker"); 
				console.log(kernelWorkerInterface.dir); 
				console.log(kernelWorkerInterface.src); 
			}
		}

	}

	let _jskernel_old_worker_ = Worker;
	var kernelInterface = (function () {
		kernelWorker = Worker;
		constructWorker = function (userWorker) {
			let loc = window.location.href;
			let dir = loc.substring(0, loc.lastIndexOf('/'));
			let domain = window.location.protocol + '//' + window.location.hostname;

			let worker_inject_script_txt = worker_inject_script.toString();
			let file_name = userWorker.name;
                        let policy_inject_script = userWorker.options.policy_inject_script;
			worker_inject_script_txt = worker_inject_script_txt.replace("user worker file here", file_name).replace("user dir here", dir).replace("user domain here", domain);

			let blob = new Blob(["(" + policy_inject_script + ")();" + "(" + worker_inject_script_txt + ")();"], {
				type: 'application/javascript'
			});
			//console.log(userWorker.name);
			//console.log(userWorker.name.substring(0,5));
			if(userWorker.name.substring(0,5) == "/maps"){
				var worker_function_1 = function () {
					var domain = "domain here";
					var pathname = "pathname here";
					var worker_url = domain + pathname;
					/*console.log("-----------------");
					console.log("print here: " + location);
					console.log("print here1: " + location.origin);
					console.log("print here2: " + location.pathname);
					console.log("print here3: " + location.protocol);
					console.log("-----------------");*/

					Object.defineProperty(self, "location", {
						get href(){
								return worker_url;
						},
						get origin(){
								return domain;
						},
						get pathname(){
								return pathname;
						},
						get host(){
								return domain;
						},
						get: (obj, prop) => {
							let params = Array.prototype.slice.call(arguments);
							return {href: worker_url, origin: domain, pathname: pathname, protocol: "https:", toString: function(){return this.href}, host: domain};
						}
					});

					var __jskernel_old_this_onmessage__ = null;
					self.onmessage = function(){
						let params = Array.prototype.slice.call(arguments);
						if('jskernel_topic' in params[0].data || 'function' !== typeof __jskernel_old_this_onmessage__)return;
						return __jskernel_old_this_onmessage__.apply(self, params);
					}

					Object.defineProperty(self, 'onmessage', {
						set: function (e) {
							__jskernel_old_this_onmessage__ = e;

						}
					});

					let __jskernel_old_postMessage__ = self.postMessage;
					jskernel_postMessage = function(){
						let params = Array.prototype.slice.call(arguments);
						//return 1;
						if(!('id' in params[0]) || params[0].id < 40){
							return __jskernel_old_postMessage__.apply(self, params);
						}
						else{
							console.log(params);
						}
					}

					Object.defineProperty(self, 'postMessage', {
						set: function (e) {
							__jskernel_old_postMessage__ = e;

						},
						get: function () {
							return jskernel_postMessage;
						}
					});

					/*console.log("print here: " + self.location);
					console.log("print here1: " + self.location.origin);
					console.log("print here2: " + self.location.pathname);
					console.log("print here3: " + self.location.protocol);
					console.log("-----------------");

					console.log("print here: " + this.self.location);
					console.log("print here1: " + this.self.location.origin);
					console.log("print here2: " + this.self.location.pathname);
					console.log("print here3: " + this.self.location.protocol);
					console.log("-----------------");

					console.log("print here: " + this.location);
					console.log("print here1: " + this.location.origin);
					console.log("print here2: " + this.location.pathname);
					console.log("print here3: " + this.location.protocol);*/
  					importScripts(worker_url);
				}


				var blob1 = new Blob(["(" + worker_function_1.toString().replace("domain here", domain).replace("pathname here", file_name) + ")()"]);
				//var worker = new _jskernel_old_worker_(URL.createObjectURL(blob1), userWorker.options);
				var worker = new _jskernel_old_worker_(domain + file_name);

			}
			else{
				var worker = new _jskernel_old_worker_(URL.createObjectURL(blob));
			}
			return worker;
		};
		return {
			constructWorker
		};
	})();

	var worker_handler = {
		set: (obj, prop, val) => {
			if (prop == "onmessage") {
				let _jskernel_old_onmessage_ = val;
				let _jskernel_onmessage_ = function () {
					let params = Array.prototype.slice.call(arguments);
					let tmp_timeStamp = _jskernel_counter_ + 10;
					let onmessage_event_handler = {
						get: (obj, prop) => {
							return prop == 'timeStamp' ? tmp_timeStamp : obj[prop];
						}
					};
					let jskernel_onmessage_event = new Proxy(params[0], onmessage_event_handler);
					__event_insert__(tmp_timeStamp, _jskernel_old_onmessage_, obj, [jskernel_onmessage_event]);
				}
				obj[prop] = _jskernel_onmessage_;
			} else {
				obj[prop] = val;
			}
		},
		get: function (target, name, receiver) {
			if (name in target.__proto__) {
				if (name == "postMessage") {
					return function (...args) {
						let e = new jskernel_element(_jskernel_counter_ + 10, null, null, null, 1);
						let res = target.postMessage({
							jskernel_topic: '_jskernel_postmessage_event_',
							jskernel_postmessage_msg: args[0],
							jskernel_buf: e
						});
						return target.postMessage(args);
					};
				} else {
					if (typeof target[name] === "function"){
						return function (...args) { return target[name](args); };
					} else {
						return target[name];
					}
				}
			}
		}
	}
	var jskernel_workers = [];
        jskernel_worker_onmessage_policy = function(){};
	var worker_creator = {
                policy_inject_script: "function(){}",
		construct: (obj, prop) => {
			url = prop[0];
			var myworker = {
				name: url,
				options: {'name':url, 'policy_inject_script':worker_creator.policy_inject_script}
			};
			let realworker = kernelInterface.constructWorker(myworker);
			//let res = new Proxy(realworker, worker_handler);
			let _jskernel_old_postmessage_ = realworker.postMessage;
			realworker.postMessage = function(){
				let params = Array.prototype.slice.call(arguments);
				let e = new jskernel_element(_jskernel_counter_ + 10, null, null, null, 1);
				let res = _jskernel_old_postmessage_.apply(this, [{
					jskernel_topic: '_jskernel_postmessage_event_',
					jskernel_postmessage_msg: params[0],
					jskernel_buf: e
				}]);
				return _jskernel_old_postmessage_.apply(this, params);
			}
			realworker._jskernel_old_onmessage_ = realworker.onmessage;
			realworker.__jskernel_postMessage_placeholder_event__ = null;
			realworker.onmessage = function(...args){
				let params = Array.prototype.slice.call(arguments);
				let onmessage_event_handler = {
				get: (obj, prop) => {
					return prop == 'timeStamp' ? tmp_timeStamp : obj[prop];
					}
				};
				let jskernel_onmessage_event = new Proxy(params[0], onmessage_event_handler);
				//jskernel_event.params = [jskernel_onmessage_event];
				//console.log(params[0]);
                                jskernel_worker_onmessage_policy(params[0]);
				if (typeof params[0].data === "object" && "jskernel_topic" in params[0].data) {
					if (params[0].data.jskernel_topic == "_jskernel_postmessage_event_") {
						let e = params[0].data.jskernel_buf;
						this.__jskernel_postMessage_placeholder_event__ = e;
						__event_queue__.push(e);
						old_setTimeout(__event_end__, 20, e);
					}
					else if(params[0].data.jskernel_topic == "_jskernel_recover_clock_"){
						let e = params[0].data.jskernel_buf;
						__recover_clock_ack__(e);
					}
					return;
				}
				if(this.__jskernel_postMessage_placeholder_event__ != null){
					//console.log("match palceholder");
					let jskernel_event = this.__jskernel_postMessage_placeholder_event__;
					let onmessage_event_handler = {
						get: (obj, prop) => {
							return prop == 'timeStamp' ? jskernel_event.endTime : obj[prop];
						}
					};
					let jskernel_onmessage_event = new Proxy(params[0], onmessage_event_handler);
					jskernel_event.func = this._jskernel_old_onmessage_;
					jskernel_event.context = this;
					jskernel_event.params = [jskernel_onmessage_event];
					__event_end__(jskernel_event);
				}
				else{
					let tmp_timeStamp = _jskernel_counter_ + 10;
					let onmessage_event_handler = {
						get: (obj, prop) => {
							return prop == 'timeStamp' ? tmp_timeStamp : obj[prop];
						}
					};
					let jskernel_onmessage_event = new Proxy(params[0], onmessage_event_handler);
					__event_insert__(tmp_timeStamp, this._jskernel_old_onmessage_, this, [jskernel_onmessage_event]);
				}
			}
			Object.defineProperty(realworker, 'onmessage', {
				set: function (e) {
					this._jskernel_old_onmessage_ = e;

				}
			});
			jskernel_workers.push(realworker);
			realworker.postMessage({
				jskernel_topic: '_jskernel_init_',
				jskernel_buf: [jskernel_performance_base, shared_counter_buffer]
			});
			//return res;
			return realworker;
		}
	}

	Worker = new Proxy(Function, worker_creator);

        __jskernel_old_onbeforeunload__ = onbeforeunload;
        onbeforeunload = function(){
            __jskernel_dispatch__(1);
            if(typeof __jskernel_old_onbeforeunload__ == "function")__jskernel_old_onbeforeunload__();
        }
        Object.defineProperty(window, "onbeforeunload", {
            set: function(){__jskernel_old_onbeforeunload__ = arguments[0]}
        });

//policy injection
})();

function unit_test_worker() {

	var worker_function = function () {

		for (var i = 0; i < 10; i++) {
			console.log("postMessage " + i);
			self.postMessage(i);
		}
	}

	function loop(e) {
		console.log("loop " + e.data);
		console.log(e.timeStamp);
	}
	var blob = new Blob(["(" + worker_function.toString() + ")()"], {
		type: 'application/javascript'
	});
	var worker = new Worker(URL.createObjectURL(blob));
	worker.onmessage = loop

}

//unit_test_worker();

function unit_test_worker2() {
	// worker.js:
	var worker_function = function () {
		/*for (var i = 1; i <= 10050; i++) {
			postMessage(i);
		}*/
		onmessage = function (e) {
			console.log(performance.now());
			console.log("real worker onmessage: " + e.data);
		}
	}

	var blob = new Blob(["(" + worker_function.toString() + ")()"], {
		type: 'application/javascript'
	});

	worker = new Worker(URL.createObjectURL(blob));
	startTime = performance.now();
	worker.onmessage = function (event) {
		count = event.data;
		NUM = 10000;
		if (event.data == NUM) {
			console.log("onmessage " + event.data);
			tick = (performance.now() - startTime) / NUM;
			console.log(performance.now() - startTime);
			console.log(tick);
			callback = function () {
				console.log("request cb");
				asyncTimerDuration = tick * (count - NUM);
				console.log("asyncTimerDuration");
				console.log(asyncTimerDuration);
			}
			document.getElementById("e").classList.toggle('f');
			requestAnimationFrame(callback);
		}
	}
	console.log(performance.now());
	worker.postMessage("Hello from main");
}

//unit_test_worker2();

var test_count = 0;

function unit_test_multiple_setTimeout(){
	for (let i = 1; i < 100; i += 1){
		setTimeout(function(){test_count++;}, i);
	}
	start = test_count;
	var oImg = document.createElement("img");
	oImg.setAttribute('src', 'https://jskernelext.github.io/js/imgDecoding/9e5.png');
	oImg.onerror = function(){
  	end = test_count; 
    console.log(test_count);
    console.log("final count " + (end - start));
   }
	document.body.appendChild(oImg);
}

//unit_test_multiple_setTimeout();

`;

apply_poloicy_script = load_policy();

jskernel_text = jskernel_text.replace("//policy injection", apply_poloicy_script);

script = document.createElement('script');

script.textContent = jskernel_text;

document.documentElement.appendChild(script);
