// Turns article markdown into HTML. All text is HTML-escaped first, so it can't add tags or
// scripts; only these markdown features become HTML: headings, paragraphs, lists, quotes, code,
// bold, italics and links. Links must be http(s), mailto or relative.

const escapes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'};
const escape = text => text.replace(/[&<>"']/g, character => escapes[character]);
const isSafeUrl = url => /^(https?:\/\/|mailto:|\/|#)/i.test(url) || !url.includes(':');

function inline(text) {
	return escape(text)
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label, url) => isSafeUrl(url) ? '<a href="' + url + '">' + label + '</a>' : label);
}

const isList = line => /^\s*([-*+]|\d+\.) /.test(line);
const startsBlock = line => /^(#{1,6} |```|> )/.test(line) || isList(line);

export function markdown(source) {
	let lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n'), html = [], i = 0;

	while(i < lines.length) {
		let line = lines[i];

		if(line.startsWith('```')) {
			let code = [];
			for(i++; i < lines.length && !lines[i].startsWith('```'); i++)
				code.push(lines[i]);
			i++;
			html.push('<pre><code>' + escape(code.join('\n')) + '</code></pre>');
		} else if(/^#{1,6} /.test(line)) {
			let level = line.indexOf(' ');
			html.push('<h' + level + '>' + inline(line.slice(level + 1)) + '</h' + level + '>');
			i++;
		} else if(isList(line)) {
			let tag = /^\s*\d+\./.test(line) ? 'ol' : 'ul', items = [];
			for(; i < lines.length && isList(lines[i]); i++)
				items.push('<li>' + inline(lines[i].replace(/^\s*([-*+]|\d+\.) /, '')) + '</li>');
			html.push('<' + tag + '>' + items.join('') + '</' + tag + '>');
		} else if(line.startsWith('> ')) {
			let quote = [];
			for(; i < lines.length && lines[i].startsWith('> '); i++)
				quote.push(lines[i].slice(2));
			html.push('<blockquote><p>' + inline(quote.join(' ')) + '</p></blockquote>');
		} else if(!line.trim()) {
			i++;
		} else {
			let paragraph = [];
			for(; i < lines.length && lines[i].trim() && !startsBlock(lines[i]); i++)
				paragraph.push(lines[i]);
			html.push('<p>' + inline(paragraph.join('\n')) + '</p>');
		}
	}

	return html.join('\n');
}
