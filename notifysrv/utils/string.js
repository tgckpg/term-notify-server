module.exports = {
	encodeHtml: function ( str, br )
	{
		str = ( str + "" ).replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;")
		;
		if( br ) str = str.replace( /\n/g, "<br/>" );
		return str;
	}
}
