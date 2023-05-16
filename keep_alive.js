require("http")
	.createServer((request, response) => {
		response.end("I'm still alive.");
	})
	.listen(process.env?.PORT || 3000, (err) => {
		if (err) {
			return console.log(err);
		}
	});
