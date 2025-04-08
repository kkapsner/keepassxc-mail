
export const log = function(){
	function f(d, n){
		const s = d.toString();
		return "0".repeat(n - s.length) + s;
	}
	return function log(...args){
		const now = new Date();
		console.log(
			`${f(now.getFullYear(), 4)}-${f(now.getMonth() + 1, 2)}-${f(now.getDate(), 2)} `+
			`${f(now.getHours(), 2)}:${f(now.getMinutes(), 2)}:` +
			`${f(now.getSeconds(), 2)}.${f(now.getMilliseconds(), 3)}:`,
			...args
		);
	};
}();