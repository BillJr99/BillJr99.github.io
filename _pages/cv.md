---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

My Full CV can be found [here](/files/CV.pdf)    
View My Scholarly Activity using the left-hand or 'Follow' navigation menu.  
View my [ORCID CV]({{ site.author.orcid }}/print)  
View my [NCBI SciEnv](https://www.ncbi.nlm.nih.gov/sciencv/) Biosketches for the [NIH](https://www.ncbi.nlm.nih.gov/myncbi/william.mongan.1/cv/548372/) and the [NSF](https://www.ncbi.nlm.nih.gov/myncbi/william.mongan.1/cv/313815/)  
View my [GitHub Resume](https://resume.github.io/?BillJr99)

Selected Faculty Appointments
======
* Faculty of Mathematics and Computer Science at Ursinus College, 2020-Present
  * Associate Professor, 2022-Present
  * Assistant Professor (Visiting), 2020-2022

* Instructor (Part-Time / Visiting) of Computer Science and Engineering at Syracuse University, 2020-2020

* Associate Department Head of Undergraduate Affairs in the Department of Computer Science at Drexel University, 2014-2019
  * Associate Department Head, 2015-2019
  * Director of Undergraduate Affairs, 2014-2015

* Lecturer (Part-Time / Visiting) of Computer and Information Science at the University of Pennsylvania, 2011-2013

* Teaching Faculty of Computer Science at Drexel University College of Engineering and College of Computing and Informatics, 2008-2019
  * Teaching Professor (full), 2017-2019
  * Associate Teaching Professor, 2012-2017
  * Assistant Teaching Professor, 2011-2012
  * Instructor / Auxiliary Professor, 2008-2011

Education
======
* Ph.D in Electrical and Computer Engineering, Drexel University, 2018
  * Dissertation: [Predictive Analytics on Real-Time Biofeedback for Actionable Classification of Activity State](/publication/dissertation)
* M.S. in Computer Science, Drexel University, 2008
  * Thesis: [A Service-Based Web Portal for Integrated Reverse Engineering and Program Comprehension](/publication/msthesis)
* M.S. in Science of Instruction, Drexel University, 2008
  * Pennsylvania Teaching Certification in Grades 7-12 Mathematics earned January, 2007
  * Grades 7-12 Computer Science subject area added July, 2021
* B.S. in Computer Science, Drexel University, 2005
  * Minor in Mathematics
  * Magna Cum Laude
  
Selected Non-Faculty Professional Appointments
======
* Educational Consultant, 2020-Present
  * Pennsylvania Training and Technical Assistance Network (PATTAN), in collaboration with the Lancaster-Lebanon Intermediate Unit, Delaware County Intermediate Unit, Chester County Intermediate Unit, and Pennsylvania Department of Education
  * Delaware Department of Education
  
* Visiting Research Scientist at Drexel University College of Engineering, 2019-Present

* Technical Writer and Research Assistant, Drexel University ACIN Program and Drexel University, 2001-2008

* IT Consultant and Software Developer, 1998-2005

Selected Awards
======
* Faculty Leadership Award, Drexel University College of Computing and Informatics, 2019
* Instructor of the Week, Drexel Center for the Advancement of STEM Teaching and Learning Excellence (CASTLE), February, 2018
* Teaching Excellence Award, Drexel University College of Computing and Informatics, 2014
* Service Award, Upper Darby School District, 2000

Selected Professional Certifications and Membership
======
* Pennsylvania Instructional I Teaching Certificate in Grades 7-12 Mathematics (2007) and Grades 7-12 Computer Science (2021)
* Upsilon Pi Epsilon International Honor Society for the Computing Sciences, 2004
* Security clearance at the level of SECRET, 2006
* FCC Amateur Radio License, Amateur Extra (2019) callsign W1CLK, 2017
* FAA Private Pilot (2005) with Instrument Rating (2006), Airplane Single Engine Land
* Senior Member (2018) of the Institute for Electrical and Electronics Engineers (IEEE), 2005
* Senior Member (2012) of the Association for Computing Machinery (ACM), 2004

Selected Publications
======
{% if site.author.dblp or site.author.csauthors %}
BibTeX Records for most publications can be found on: {% if site.author.dblp %}
[DBLP](https://dblp.uni-trier.de/pers/tb1/{{ site.author.dblp }}.bib) {% endif %}{% if site.author.csauthors %}[CSAuthors](https://www.csauthors.net/{{ site.author.csauthors }}/{{ site.author.csauthors }}.bib) {% endif %}
{% endif %}

  <ul>{% for post in site.publications reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Selected Talks
======
  <ul>{% for post in site.talks reversed %}
    {% include archive-single-talk-cv.html %}
  {% endfor %}</ul>
  
Selected Teaching
======
  <ul>{% for post in site.teaching reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
