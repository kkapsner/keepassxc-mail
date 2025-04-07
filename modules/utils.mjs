export async function wait(ms, returnValue){
	return new Promise(function(resolve){
		window.setTimeout(function(){
			resolve(returnValue);
		}, ms);
	});
}