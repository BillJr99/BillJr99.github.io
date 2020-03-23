import frontmatter
import sys
from datetime import datetime,timedelta
import uuid
from dateutil import tz

def getDayNum(dayidx, M, T, W, R, F, S, U):
    result = 0
    
    if M:
        dayidx = dayidx - 1
        
        if dayidx == -1:
            result = 0
    
    if T:
        dayidx = dayidx - 1
        
        if dayidx == -1:
            result = 1

    if W:
        dayidx = dayidx - 1
        
        if dayidx == -1:
            result = 2

    if R:
        dayidx = dayidx - 1
        
        if dayidx == -1:
            result = 3

    if F:
        dayidx = dayidx - 1
        
        if dayidx == -1:
            result = 4

    if S:
        dayidx = dayidx - 1
        
        if dayidx == -1:
            result = 5

    if U:
        dayidx = dayidx - 1
        
        if dayidx == -1:
            result = 6

    return result
    
def getDateString(dt):
    return dt.strftime('%Y%m%d')
    
def getTimeStringAsZulu(t):
    # Convert from Eastern Time/Local Time Zone to Zulu Time
    # https://stackoverflow.com/questions/4770297/convert-utc-datetime-string-to-local-datetime
    
    from_zone = tz.tzlocal() # tz.gettz('America/New_York')
    to_zone = tz.tzutc() # tz.gettz('UTC')
    
    t = t.replace(tzinfo=from_zone)
    t = t.astimezone(to_zone)
    
    return t.strftime('%H%M%S')
    
def parseDate(dt):
    return datetime.strptime(dt, '%Y/%m/%d')
    
def parseTime(t):
    return datetime.strptime(t, '%I:%M %p')
    
def adddays(dt, n):
    return dt + timedelta(days=n)
    
def addweeks(dt, n):
    return dt + timedelta(days=7*n)
    
def getCourseDate(startdate, weeknum, dayidx, M, T, W, R, F, S, U):
    dt = parseDate(startdate)
    weeknum = int(weeknum)
    dayidx = int(dayidx)
    
    dt = addweeks(dt, weeknum)
    daynum = getDayNum(dayidx, M, T, W, R, F, S, U)
    dt = adddays(dt, daynum)
    
    return getDateString(dt)

def geticalday(d):
    if d == 'M':
        return 'MO'
    elif d == "T":
        return "TU"
    elif d == "W":
        return "WE"
    elif d == "R":
        return "TH"
    elif d == "F":
        return "FR"
    elif d == "S":
        return "SA"
    elif d == "U":
        return "SU"
    else:
        return ""
    
if len(sys.argv) <= 1:
    print("Specify md file")
    sys.exit(0)

fname = sys.argv[1]
f = open(fname, 'r')
mdcontents = f.read()

outfname = 'out.ics'
outf = open(outfname, 'w')

post = frontmatter.loads(mdcontents)
postdict = post.to_dict()

coursenum = postdict['info']['course_number']
coursename = postdict['info']['course_title']
startdate = postdict['info']['course_start_date']
enddate = postdict['info']['course_end_date']
isM = postdict['info']['class_meets_days']['isM']
isT = postdict['info']['class_meets_days']['isT']
isW = postdict['info']['class_meets_days']['isW']
isR = postdict['info']['class_meets_days']['isR']
isF = postdict['info']['class_meets_days']['isF']
isS = postdict['info']['class_meets_days']['isS']
isU = postdict['info']['class_meets_days']['isU']

outf.write("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")

# Write the lecture schedule as a recurring event
for meeting in postdict['info']['class_meets_locations']:
    dtstart = getDateString(parseDate(startdate))
    dtstart = dtstart + "T"
    dtstart = dtstart + getTimeStringAsZulu(parseTime(meeting['starttime']))
    dtstart = dtstart + "Z"
    
    dtend = getDateString(parseDate(startdate)) # assume no event overlaps a day boundary, ends on start date
    dtend = dtend + "T"
    dtend = dtend + getTimeStringAsZulu(parseTime(meeting['endtime']))
    dtend = dtend + "Z"    
    
    dtuntil = getDateString(parseDate(enddate)) # for recurrence rule
    dtuntil = dtuntil + "T"
    dtuntil = dtuntil + "000000"
    dtuntil = dtuntil + "Z" 

    location = meeting['place']
    
    repeatday = geticalday(meeting['day'])
    
    rrule = "RRULE:FREQ=WEEKLY;BYDAY=" + repeatday + ";INTERVAL=1;UNTIL=" + dtuntil
    for holiday in postdict['info']['holidays']:
        dtholiday = getDateString(parseDate(holiday['date']))       
        rrule = rrule + "\r\nEXDATE:" + dtholiday

    outf.write("BEGIN:VEVENT\r\nUID:" + str(uuid.uuid4()) + "\r\nDTSTAMP:" + dtstart + "\r\nDTSTART:" + dtstart + "\r\nDTEND:" + dtend + "\r\n" + rrule + "\r\nSUMMARY:" + coursenum + " " + coursename + " Class Meeting\r\nLOCATION:" + location + "\r\nDESCRIPTION:\r\nPRIORITY:3\r\nEND:VEVENT\r\n")

for item in postdict['schedule']:   
    weekidx = item['week']
    dayidx = item['date']
    title = item['title']
    link = item['link']
    
    startd = getCourseDate(startdate, weekidx, dayidx, isM, isT, isW, isR, isF, isS, isU)
    description = link.strip()
    
    for reading in item['readings']:      
        rtitle = reading['rtitle']
        rlink = reading['rlink']
        
        description = description.strip() + "\r\nReading: " + rtitle.strip() + " (" + rlink.strip() + ")"
        
    for deliverable in item['deliverables']:        
        dtitle = deliverable['dtitle']
        dlink = deliverable['dlink']
        
        description = description.strip() + "\r\nDeliverable: " + dtitle.strip() + " (" + dlink.strip() + ")"
        
        # Write the Assignment as an all-day event
        outf.write("BEGIN:VEVENT\r\nUID:" + str(uuid.uuid4()) + "\r\nDTSTAMP:" + startd + "T000000Z" + "\r\nDTSTART;VALUE=DATE:" + startd + "\r\nSUMMARY:Class " + coursenum.strip() + " " + dtitle.strip() + "\r\nLOCATION:\r\nDESCRIPTION:\r\nPRIORITY:3\r\nEND:VEVENT\r\n")        
        
    # Write the lecture as an all-day event:
    outf.write("BEGIN:VEVENT\r\nUID:" + str(uuid.uuid4()) + "\r\nDTSTAMP:" + startd + "T000000Z" + "\r\nDTSTART;VALUE=DATE:" + startd + "\r\nSUMMARY:" + coursenum + " " + coursename + " Class Meeting\r\nLOCATION:\r\nDESCRIPTION:" + description.strip() + "\r\nPRIORITY:3\r\nEND:VEVENT\r\n")

outf.write("END:VCALENDAR\r\n")

f.close()
outf.close()