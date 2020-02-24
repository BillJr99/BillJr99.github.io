function printOfficehours() {
    document.write(officehours)
}

function listCourses(summary, list, tag, link) {
    try {
		if(tag === null) {
			tag = ""
		}
	} catch(e) {
		tag = ""
	}
	
	if(tag === undefined || tag === null) {
		tag = ""
	}
	
	document.write("<ul " + tag + ">")
	var i
	for(i = 0; i < list.length; i+=6) {
		document.write("<li>")
		listCourse(list[i], list[i+1], list[i+2], list[i+3], list[i+4], list[i+5], summary, link)
		document.write("</li>")
	}
	document.write("</ul>")
}

function listCourse(title, room, thetime, url, location, quarter, summary, link) {
	if(summary == 0) {
		if(link == 1) {
			document.write("<a href=\"" + url + "\">" + title + "</a> at " + thetime + " in " + room)
		} else {
			document.write(title + " at " + thetime + " in " + room)
		}
	} else {
		if(link == 1) {
			document.write("<a href=\"" + url + "\">" + title + "</a><br>" + location + "<br>" + quarter)
		} else {
			document.write(title + "<br>" + location + "<br>" + quarter)
		}
	}
}
