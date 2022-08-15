import { html as lithtml } from "lit";

const SPACE_CHAR = `[ \t\n\f\r]`;
const ATTR_VALUE_CHAR = `[^ \t\n\f\r"'\`<>=]`;
const NAME_CHAR = `[^\\s"'>=/]`;
const textEndRegex = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
const COMMENT_START = 1;
const TAG_NAME = 2;
const DYNAMIC_TAG_NAME = 3;
const commentEndRegex = /-->/g;
const comment2EndRegex = />/g;
const tagEndRegex = new RegExp(
  `>|${SPACE_CHAR}(?:(${NAME_CHAR}+)(${SPACE_CHAR}*=${SPACE_CHAR}*(?:${ATTR_VALUE_CHAR}|("|')|))|$)`,
  'g'
);
const ENTIRE_MATCH = 0;
const ATTRIBUTE_NAME = 1;
const SPACES_AND_EQUALS = 2;
const QUOTE_CHAR = 3;
const singleQuoteAttrEndRegex = /'/g;
const doubleQuoteAttrEndRegex = /"/g;
const rawTextElement = /^(?:script|style|textarea|title)$/i;

const noclose = new Set([
	"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
	"meta", "param", "source", "track", "wbr",
]);


const cache = new WeakMap();

//document.time_sum = 0;
//let time_start;

export function html(strings, ...values){
	//time_start = performance.now();
  const l = strings.length;

	if( !strings.filter( s => s.includes("/>") ).length ){
		return lithtml(strings, ...values);
	}

	const modified = []
	
  const attrNames = [];

  let rawTextEndRegex = undefined;
  let regex = textEndRegex;

	let tagname = "";
	
	
  for (let i = 0; i < l; i++) {
    let s = strings[i];
		let closed = 0;

    let attrNameEndIndex = -1;
    let attrName = undefined;
    let lastIndex = 0;
    let match = null;

    while (lastIndex < s.length) {
      regex.lastIndex = lastIndex;
      match = regex.exec(s);
      if (match === null) {
				//console.log("NULL");
        break;
      }
      lastIndex = regex.lastIndex;
      if (regex === textEndRegex) {
				//console.log("TEXT");
        if (match[COMMENT_START] === '!--') {
          regex = commentEndRegex;
        } else if (match[COMMENT_START] !== undefined) {
          // We started a weird comment, like </{
          regex = comment2EndRegex;
        } else if (match[TAG_NAME] !== undefined) {
          if (rawTextElement.test(match[TAG_NAME])) {
            rawTextEndRegex = new RegExp(`</${match[TAG_NAME]}`, 'g');
          }

					tagname = match[TAG_NAME].replace("/","");
					//console.log("\nTAGNAME", tagname );
          regex = tagEndRegex;
        } else if (match[DYNAMIC_TAG_NAME] !== undefined) {
          regex = tagEndRegex;
        }
      } else if (regex === tagEndRegex) {
				//console.log("TAG")
        if (match[ENTIRE_MATCH] === '>') {
          // End of a tag. If we had started a raw-text element, use that
          // regex
          regex = rawTextEndRegex ?? textEndRegex;
          attrNameEndIndex = -1;

					if( s.charAt(lastIndex-2)==="/" &&
							! noclose.has(tagname.toLowerCase() )
						){
						//console.log("CLOSE", tagname );
						let str = s.substring(0,lastIndex-2) + "></"+tagname+">" + s.substring(lastIndex);
						lastIndex += tagname.length + 2;
						s = str;

						closed++;
					}
					//console.log("TAGEND", lastIndex, s.slice(lastIndex-2,lastIndex));
				} else if (match[ATTRIBUTE_NAME] === undefined) {
          // Attribute name position
          attrNameEndIndex = -2;
        } else {
          attrNameEndIndex = regex.lastIndex - match[SPACES_AND_EQUALS].length;
          attrName = match[ATTRIBUTE_NAME];
          regex =
            match[QUOTE_CHAR] === undefined
              ? tagEndRegex
              : match[QUOTE_CHAR] === '"'
              ? doubleQuoteAttrEndRegex
              : singleQuoteAttrEndRegex;
        }
      } else if (
        regex === doubleQuoteAttrEndRegex ||
        regex === singleQuoteAttrEndRegex
      ) {
				//console.log("QUOTE");
        regex = tagEndRegex;
      } else if (regex === commentEndRegex || regex === comment2EndRegex) {
				//console.log("COMMENT");
        regex = textEndRegex;
      } else {
				//console.log("NONE");
        regex = tagEndRegex;
        rawTextEndRegex = undefined;
      }
    }
		
		if( closed ) modified.push([i,s]);
  }

	
	if( !modified.length ) return lithtml(strings, ...values);

	let tmpl = cache.get( strings.raw );
	if( !tmpl ){
		tmpl = Array.from(strings);
		tmpl.raw = strings.raw;
		for( const [i,s] of modified ){
			tmpl[i]=s;
		}
		cache.set( strings.raw, tmpl );
	}

	//document.time_sum += performance.now() - time_start;
	return lithtml(tmpl, ...values)
}

