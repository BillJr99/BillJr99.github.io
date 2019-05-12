function listInstructors() {
	var i
	document.write("<ol>")

	for(i = 0; i < instructor.length; i += 4) {
		document.write("<li><b>" + instructor[i] + "</b>: " + instructor[i+1] + " (" + instructor[i+2] + ")<br>Office Hours: " + instructor[i+3] + "</li>")
	}

document.write("</ol>")
}

function printCreditHours() {
	document.write(credithours);
}

function printTerm() {
	document.write(termcode + ": " + term);
}

function listTas() {
	var i
	var anyTAs = 0
	document.write("<ol>")

	for(i = 0; i < TA.length; i += 4) {
		if(TA[i+3] == 1) { // if this is a real visible TA, display it.  Some TA's may not be posted because they're course admins for submit purposes
			anyTAs = 1
			document.write("<li><b>" + TA[i] + "</b> (" + TA[i+1] + ")<br>Office Hours: " + TA[i+2] + "</li>")
		}
	}

	if(anyTAs == 0) {
		document.write("<li>None</li>")
	}

	document.write("</ol>")
}

function listMeetingTimes() {
	var i

	for(i = 0; i < meetingtime.length; i += 3) {
		document.write("<b>" + meetingtime[i] + "</b>: " + meetingtime[i+1] + " in Room " + meetingtime[i+2] + "<br>")
	}
}

function listCourseWebPage() {
	var i

	for(i = 0; i < website.length; i += 2) {
    document.write(website[i] + ": <a href='" + website[i+1] + "'>" + website[i+1] + "</a><br>")
  }
}

function printLatePolicy() {
	document.write(latePolicy)
}

function printCSHonestyPolicy() {
	document.write(csHonestyPolicy)
}

function listBooks() {
	var i = 0

	document.write("<ol>")

	for(i = 0; i < books.length; i += 4) {
		document.write("<li><b>" + books[i] + "</b>.  " + books[i+1] + ".  " + books[i+2] + ": " + books[i+3] + "</li>")
	}

	if(recbooks.length > 0) {
		for(i = 0; i < recbooks.length; i += 4) {
			document.write("<li>Recommended: <b>" + recbooks[i] + "</b>.  " + recbooks[i+1] + ".  " + recbooks[i+2] + ": " + recbooks[i+3] + "</li>")
		}
	}
						 
	document.write("</ol>")
}

// Assumes the primary website for printing the left bar
function left_nav(separator, linktags, latest) {
    try {
		if(separator === null) {
			separator = "<br>"
		}
	} catch(e) {
		separator = "<br>"
	}
	
    if(separator == undefined) {
        separator = "<br>";
    }
    
    try {
		if(linktags === null) {
			linktags = ""
		}
	} catch(e) {
		linktags = ""
	}
	
    if(linktags === undefined) {
        linktags = "";
    }
    
    try {
		if(latest === null) {
			latest = 1
		}
	} catch(e) {
		latest = 1
	}
	
    if(latest === undefined) {
		latest = 1;
    }
    
	var i = 0

	for(i = 0; i < leftbar.length; i+= 2) {
		// append website root to non-external links
		if(leftbar[i+1].indexOf("http") == -1) {
			document.write("<a " + linktags + " href='" + website[1] + "/" + leftbar[i+1] + "'>" + leftbar[i] + "</a>" + separator)
		} else {
			document.write("<a " + linktags + " href='" + leftbar[i+1] + "'>" + leftbar[i] + "</a>" + separator)
		}
		if(leftbar[i] == "Announcements" && latest != 0) {
			document.write("<b>Latest: " + latestannouncement + "</b>" + separator)
		}
		document.write(separator)
	}
}

function description() {
	document.write(course_description + "<br>")
}

function listPrereqs() {
	document.write(prereqs + "<br>")
}

function printTitle() {
	document.write(coursenum + " " + coursename)
}

function setTitle() {
	document.title = coursenum + " " + coursename
}

function listAnnouncements() {
	var i = 0

	if(announcements.length > 0) {
		document.write("<ol>")
	}

	for(i = 0; i < announcements.length; i += 2) {
		var curAnnDate = new Date(announcements[i])

		document.write("<li><b>" + days[curAnnDate.getDay()] + ", " + months[curAnnDate.getMonth()] + " " + curAnnDate.getDate() + ", " + curAnnDate.getFullYear() + "</b>: " + announcements[i+1] + "</li>")
	}

	if(announcements.length > 0) {
		document.write("</ol>")
	}
}

function listGrades() {
	var i = 0

	document.write("<ol>")

	for(i = 0; i < grades.length; i += 2) {
		document.write("<li>" + grades[i] + " " + grades[i+1] + "</li>")
	}

	document.write("</ol>")
}

function listGradeBreakdown() {
	var i = 0

	document.write("<ul>")

	for(i = 0; i < grade_breakdown.length; i += 2) {
		document.write("<li>" + grade_breakdown[i] + " is a course average " + grade_breakdown[i+1] + "</li>")
	}

	document.write("</ul>")
}

function listObjectives() {
	var i = 0

	document.write("<ol>")

	for(i = 0; i < objectives.length; i++) {
		document.write("<li>" + objectives[i] + "</li>")
	}

	document.write("</ol>")
}

function printAudience() {
	document.write(audience)
}

function printShouldKnow() {
	var i = 0

	document.write("<ol>")

	for(i = 0; i < shouldKnow.length; i++) {
		document.write("<li>" + shouldKnow[i] + "</li>")
	}

	document.write("</ol>")
}

function printWillKnow() {
  var i = 0
	 
	document.write("<ol>")

	for(i = 0; i < willKnow.length; i++) {
			 document.write("<li>" + willKnow[i] + "</li>")
	}

	document.write("</ol>")
}


function listTopics() {
  var i = 0
	 
	document.write("<ol>")

	for(i = 0; i < topics.length; i++) {
			 document.write("<li>" + topics[i] + "</li>")
	}

	document.write("</ol>")
}

function printSubmissionMethod() {
	document.write(submission_method + "<br>")
}

function listAssignments() {
	var i = 0

	document.write("<table border=\"2\" cellspacing=\"3\" style=\"border-collapse: collapse\" bordercolor=\"#111111\" width=\"100%\"><tbody><tr>")
	document.write("<td width=\"10%\"><b>Submission Code</b></td>")
	document.write("<td width=\"30%\"><b>Assignment</b></td>")
	document.write("<td width=\"30%\"><b>Due Date</b></td>")
	document.write("<td width=\"30%\"><b>Grader</b></td>")
	document.write("</tr>")

	for(i = 0; i < assignments.length; i += 5) {
		document.write("<tr>")

		document.write("<td>" + assignments[i] + "</td>")
		if(assignments[i+2].length > 1) {
		    document.write("<td><a href='" + assignments[i+2] + "'>" + assignments[i+1] + "</a></td>")
		} else {
		    document.write("<td>" + assignments[i+1] + "</td>")
		}
		if(!assignments[i+3].toLowerCase().match("nothing to hand in")) {
			var dueDate = new Date(assignments[i+3])
			document.write("<td>" + days[dueDate.getDay()] + ", " + months[dueDate.getMonth()] + " " + dueDate.getDate() + ", " + dueDate.getFullYear() + "</td>")
		} else {
			document.write("<td>Nothing to Hand In</td>")
		}
		document.write("<td>" + TA[assignments[i+4] * 4] + "</td>")

		document.write("</tr>")
	}

	document.write("</tr></tbody></table>")
}


function listLabs() {
	var i = 0

	document.write("<table border=\"2\" cellspacing=\"3\" style=\"border-collapse: collapse\" bordercolor=\"#111111\" width=\"100%\"><tbody><tr>")
	document.write("<td width=\"10%\"><b>Submission Code</b></td>")
	document.write("<td width=\"30%\"><b>Lab</b></td>")
	document.write("<td width=\"30%\"><b>Due Date</b></td>")
	document.write("<td width=\"30%\"><b>Grader</b></td>")
	document.write("</tr>")

	for(i = 0; i < labs.length; i += 5) {
		document.write("<tr>")

		document.write("<td>" + labs[i] + "</td>")
		if(labs[i+2].length > 1) {
		    document.write("<td><a href='" + labs[i+2] + "'>" + labs[i+1] + "</a></td>")
		} else {
		    document.write("<td>" + labs[i+1] + "</td>")
		}
		if(!labs[i+3].toLowerCase().match("nothing to hand in")) {
			var dueDate = new Date(labs[i+3])
			document.write("<td>" + days[dueDate.getDay()] + ", " + months[dueDate.getMonth()] + " " + dueDate.getDate() + ", " + dueDate.getFullYear() + "</td>")
		} else {
			document.write("<td>Nothing to Hand In</td>")
		}
		document.write("<td>" + TA[labs[i+4] * 4] + "</td>")

		document.write("</tr>")
	}

	document.write("</tr></tbody></table>")
}

function listProjects() {
	var i = 0

	document.write("<table border=\"2\" cellspacing=\"3\" style=\"border-collapse: collapse\" bordercolor=\"#111111\" width=\"100%\"><tbody><tr>")
	document.write("<td width=\"10%\"><b>Submission Code</b></td>")
	document.write("<td width=\"30%\"><b>Project</b></td>")
	document.write("<td width=\"30%\"><b>Due Date</b></td>")
	document.write("<td width=\"30%\"><b>Grader</b></td>")
	document.write("</tr>")

	for(i = 0; i < projects.length; i += 5) {
		document.write("<tr>")

		document.write("<td>" + projects[i] + "</td>")
		if(projects[i+2].length > 1) {
		    document.write("<td><a href='" + projects[i+2] + "'>" + projects[i+1] + "</a></td>")
		} else {
		    document.write("<td>" + projects[i+1] + "</td>")
		}
		if(!projects[i+3].toLowerCase().match("nothing to hand in")) {
			var dueDate = new Date(projects[i+3])
			document.write("<td>" + days[dueDate.getDay()] + ", " + months[dueDate.getMonth()] + " " + dueDate.getDate() + ", " + dueDate.getFullYear() + "</td>")
		} else {
			document.write("<td>Nothing to Hand In</td>")
		}
		document.write("<td>" + TA[projects[i+4] * 4] + "</td>")

		document.write("</tr>")
	}

	document.write("</tr></tbody></table>")
}


function listAllDeliverables() {
    try {
		if(projects === null) {
			projects = []
		}
	} catch(e) {
		projects = []
	}
	
	if(projects.length > 0) {
		document.write("<b>Projects</b>")
		
		listProjects()
		
		document.write("<br>")
	}	
	
    try {
		if(assignments === null) {
			assignments = []
		}
	} catch(e) {
		assignments = []
	}
	
	if(assignments.length > 0) {
		document.write("<b>Assignments</b>")
		
		listAssignments()
		
		document.write("<br>")
	}
	
    try {
		if(labs === null) {
			labs = []
		}
	} catch(e) {
		labs = []
	}
	
	if(labs.length > 0) {
		document.write("<b>Labs</b>")
		
		listLabs()
		
		document.write("<br>")
	}
}


function listWhatsDueThisWeek() {
	var i = 0

	document.write("<table border=\"2\" cellspacing=\"3\" style=\"border-collapse: collapse\" bordercolor=\"#111111\" width=\"100%\"><tbody><tr>")
	document.write("<td width=\"10%\"><b>Submission Code</b></td>")
	document.write("<td width=\"30%\"><b>Deliverable</b></td>")
	document.write("<td width=\"30%\"><b>Due Date</b></td>")
	document.write("<td width=\"30%\"><b>Grader</b></td>")
	document.write("</tr>")

    try {
		if(projects === null) {
			projects = []
		}
	} catch(e) {
		projects = []
	}
	
	if(projects !== null) {
		for(i = 0; i < projects.length; i += 5) {
			if(dueThisWeek(projects[i+3])) {
				document.write("<tr>")

				document.write("<td>" + projects[i] + "</td>")
				if(projects[i+2].length > 1) {
					document.write("<td><a href='" + projects[i+2] + "'>" + projects[i+1] + "</a></td>")
				} else {
					document.write("<td>" + projects[i+1] + "</td>")
				}			
				if(!projects[i+3].toLowerCase().match("nothing to hand in")) {
					var dueDate = new Date(projects[i+3])
					document.write("<td>" + days[dueDate.getDay()] + ", " + months[dueDate.getMonth()] + " " + dueDate.getDate() + ", " + dueDate.getFullYear() + "</td>")
				} else {
					document.write("<td>Nothing to Hand In</td>")
				}
				document.write("<td>" + TA[projects[i+4] * 4] + "</td>")
	
				document.write("</tr>")
			}
		}
	}

    try {
		if(assignments === null) {
			assignments = []
		}
	} catch(e) {
		assignments = []
	}

	if(assignments !== null) {
        for(i = 0; i < assignments.length; i += 5) {
			if(dueThisWeek(assignments[i+3])) {
	                document.write("<tr>")
          
        	        document.write("<td>" + assignments[i] + "</td>")
					if(assignments[i+2].length > 1) {
						document.write("<td><a href='" + assignments[i+2] + "'>" + assignments[i+1] + "</a></td>")
					} else {
						document.write("<td>" + assignments[i+1] + "</td>")
					}	
					if(!assignments[i+3].toLowerCase().match("nothing to hand in")) {
						var dueDate = new Date(assignments[i+3])
                	        document.write("<td>" + days[dueDate.getDay()] + ", " + months[dueDate.getMonth()] + " " + dueDate.getDate() + ", " + dueDate.getFullYear() + "</td>")
	                } else {
        	                document.write("<td>Nothing to Hand In</td>")
                	}       
	                document.write("<td>" + TA[assignments[i+4] * 4] + "</td>")
                        
        	        document.write("</tr>")
				}
        }
	}

    try {
		if(labs === null) {
			labs = []
		}
	} catch(e) {
		labs = []
	}
	
	if(labs !== null) {
        for(i = 0; i < labs.length; i += 5) {
			if(dueThisWeek(labs[i+3])) {
	                document.write("<tr>")
          
        	        document.write("<td>" + labs[i] + "</td>")
					if(labs[i+2].length > 1) {
						document.write("<td><a href='" + labs[i+2] + "'>" + labs[i+1] + "</a></td>")
					} else {
						document.write("<td>" + labs[i+1] + "</td>")
					}	
					if(!labs[i+3].toLowerCase().match("nothing to hand in")) {
                	        var dueDate = new Date(labs[i+3])
                	        document.write("<td>" + days[dueDate.getDay()] + ", " + months[dueDate.getMonth()] + " " + dueDate.getDate() + ", " + dueDate.getFullYear() + "</td>")
                	} else {
                        	document.write("<td>Nothing to Hand In</td>")
                	}       
                	document.write("<td>" + TA[labs[i+4] * 4] + "</td>")
                        
                	document.write("</tr>")
				}
        }
	}


	document.write("</tr></tbody></table>")
}


function dueThisWeek(dueDate) {
	if(dueDate.toLowerCase().match("nothing to hand in")) {
		return false
	} else {
		var d = new Date(dueDate)
		var today = new Date()
		var one_day=1000*60*60*24
		var dateDiff = d - today
		if(dateDiff < -1 * (1000*60*60*24)) {
			return false
		} else {
			var daysDiff = dateDiff / one_day
		if(daysDiff < 7) {
			return true
		} else {
			return false
		}
	}
}
}

function listDrexelPolicies() {
document.write("In addition to the course policies listed on this syllabus, course assignments or course website, the following University policies are in effect:");
document.write("<ul>")
document.write("<li>Academic Integrity, Plagiarism, Dishonesty and Cheating Policy: <a href=\"http://www.drexel.edu/provost/policies/academic_dishonesty.asp\">http://www.drexel.edu/provost/policies/academic_dishonesty.asp</a></li>")
document.write("<li>Judicial Affairs Academic Integrity: <a href=\"http://www.drexel.edu/provost/policies/academic-integrity\">http://www.drexel.edu/provost/policies/academic-integrity</a></li>")
document.write("<li>Official Final Exam Schedule: <a href=\"http://www.drexel.edu/registrar/exams/\">http://www.drexel.edu/registrar/exams/</a></li>")
document.write("<li>Students with Disability Statement: <a href=\"http://drexel.edu/oed/disabilityResources/students/\">http://drexel.edu/oed/disabilityResources/students/</a></li>")
document.write("<li>Students <a href=\"http://drexel.edu/oed/disabilityResources/students/\">requesting accommodations</a> due to a disability at Drexel University need to request a current Accommodations Verification Letter (AVL) in the <a href=\"http://accommodate.drexel.edu/ClockWork/\">ClockWork</a> database before accommodations can be made. These requests are received by Disability Resources (DR), who then issues the AVL to the appropriate contacts. For additional information, visit the DR website at <a href=\"http://drexel.edu/oed/disabilityResources/overview/\">drexel.edu/oed/disabilityResources/overview/</a>, or contact DR for more information by phone at 215.895.1401, or by email at <a href=\"mailto:disability@drexel.edu\">disability@drexel.edu.</a></li>")
document.write("<li>Course Add/Drop Policy: <a href=\"http://www.drexel.edu/provost/policies/course-add-drop\">http://www.drexel.edu/provost/policies/course-add-drop</a></li>")
document.write("<li>Course Withdrawl Policy: <a href=\"http://drexel.edu/provost/policies/course-withdrawal\">http://drexel.edu/provost/policies/course-withdrawal</a></li>")
document.write("<li>The instructor may, at his/her/their discretion, change any part of the course during the term, including assignments, grade brakdowns, due-dates, and the schedule.  Such changes will be communicated to students via the course web site Announcements page.  This page should be checked regularly and frequently for such changes and announcements.  Other announcements, although rare, may include class cancellations and other urgent announcements.</li>")
document.write("<li>Drexel Student Learning Priorities: <a href=\"http://drexel.edu/provost/assessment/outcomes/dslp/\">http://drexel.edu/provost/assessment/outcomes/dslp/</a></li>")
document.write("</ul>")
}



function listLectures() {
    var startDate = new Date(term_start) // Assume Monday
    var i = 0

	document.write("<table border=\"2\" cellspacing=\"3\" style=\"border-collapse: collapse\" bordercolor=\"#111111\" width=\"100%\"><tbody><tr>")
	document.write("<td width=\"5%\"><b>Week #</b></td>")
	document.write("<td width=\10%\"><b>Dates</b></td>")
	document.write("<td width=\10%\"><b>Lecture Topics</b></td>")
	document.write("<td width=\10%\"><b>Labs, Readings and Whitepapers</b></td>")
	document.write("<td width=\10%\"><b>Notes</b></td>")
    document.write("</tr>")

	var lastWeekNum = 0
	for(i = 0; i < lectures.length; i += 5) {
		var thisWeekNum = lectures[i]
		var thisWeekDate = new Date(startDate)
		thisWeekDate.setDate(thisWeekDate.getDate() + (7 * (thisWeekNum - 1)))

		document.write("<tr>")
		document.write("<td>" + lectures[i] + "</td>")
		document.write("<td>Week of " + formatDateMDY(thisWeekDate) + "</td>")	
		if(lectures[i+2].length > 0) {
			document.write("<td><a href='" + lectures[i+2] + "'>" + lectures[i+1] + "</a></td>")	
		} else {
			document.write("<td>" + lectures[i+1] + "</td>")		          }
		document.write("<td>" + lectures[i+3] + "</td>")	
		document.write("<td>" + lectures[i+4] + "</td>")	
		document.write("</tr>")

		lastWeekNum = thisWeekNum
	}

  document.write("</tr></tbody></table>")

  if(holidays.length > 0) {
		var j = 0

		document.write("<p><b>Holidays</b></p>")
		document.write("Please note the following holidays.  If we have class normally scheduled on these days, we will not meet.")
		
		document.write("<ul>")
		for(j = 0; j < holidays.length; j++) {
			document.write("<li>" + holidays[j] + "</li>")
		}
		document.write("</ul>")
          }
}

function formatDateMDY(theDate) {
  var theDateDate = new Date(theDate)
  var y = theDateDate.getYear()
  if(y < 1900) {
	y = y + 1900
  }
	return months[theDateDate.getMonth()] + " " + theDateDate.getDate() + ", " + y
}

function printAdditionalInfo() {
	document.write(additionalInfo)
}
