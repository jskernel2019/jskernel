
load_policy_script = `


let jskernel = {};

jskernel.worker_creator = worker_creator;
jskernel.event_queue = __event_queue__;

function redefine_main(obj, policy, jskernel_obj){
    for(let prop in policy){
        if('func' in policy[prop]){
            let new_func = policy[prop]['func'];
            jskernel_obj[prop] = obj[prop];
            obj[prop] = new_func;
        }
        let set_get_obj = {};
        if('get' in policy[prop]){
            let new_func = policy[prop]['get'];
            set_get_obj.get = new_func;
        }
        if('set' in policy[prop]){
            let new_func = policy[prop]['set'];
            set_get_obj.set = new_func;
        }
        if('set' in policy[prop] || 'get' in policy[prop]){
            old_object_defineProperty(obj, prop, set_get_obj);
        }
        if(!('func' in policy[prop]) && !('get' in policy[prop]) && !('set' in policy[prop])){
            let next_obj = obj[prop];
            jskernel_obj[prop] = {};
            redefine_main(next_obj, policy[prop], jskernel_obj[prop]);
        }
    }
}

function redefine_worker(obj, policy, jskernel){
    let worker_script = '';
    for(let prop in policy){
        if('func' in policy[prop]){
            new_func = policy[prop]['func'].toString();
            worker_script += jskernel + '["' + prop + '"] = ' + obj + '["' + prop + '"];'
            worker_script += obj + '["' + prop + '"] = ' + new_func + ";"
        }
        if('get' in policy[prop]){
            new_func = policy[prop]['get'].toString();
            worker_script += "Object.defineProperty(" + obj + ', "' + prop + '", { get: ' + new_func + " });"
        }
        if('set' in policy[prop]){
            new_func = policy[prop]['set'].toString();
            worker_script += "Object.defineProperty(" + obj + ', "' + prop + '", { set: ' + new_func + " });"
        }
        if(!('func' in policy[prop]) && !('get' in policy[prop]) && !('set' in policy[prop])){
            let next_obj = obj+ "." + prop;
            worker_script += redefine_worker(next_obj, policy[prop], jskernel + '.' + prop);
        }
    }
    return worker_script;
}

function parse_policy(policy){

    let policy_obj = policy;
    let worker_script = "jskernel = {};enforce_policy=function(){";
    for (var area in policy_obj) {
        if(area == "main"){
            redefine_main(self, policy_obj[area], jskernel);
        }
        if(area == "worker"){
            worker_script += redefine_worker('self', policy_obj[area], "jskernel");
        }
    }
    worker_script = "function(){console.log('hello from worker');" + worker_script + "};enforce_policy();}"
    jskernel.worker_creator.policy_inject_script = worker_script;
}

policy_text=your policy here;

parse_policy(policy_text);

`;

function obj2txt(obj){
    if(typeof obj == "function")return obj.toString();
    let res = "{";
    for(let prop in obj){
        res += prop + ":" + obj2txt(obj[prop]) + ",";
    }
    res = res.substring(0, res.length - 1) + "}";
    return res;
}

function append_policy(policy_obj){
    load_policy_script_text = load_policy_script.toString()
    load_policy_script_text = load_policy_script_text.replace("your policy here", obj2txt(policy_obj));
    
    return load_policy_script_text;
}

function load_policy(){
    let policy_obj = jskernel_policy;
    return append_policy(policy_obj);
}
