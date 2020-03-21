---
title: "ASRM"
excerpt: "The Agent Systems Reference Model (ASRM)"
collection: portfolio
comments: true
tags:
  - asrm
---

The [Agent Systems Reference Model (ASRM)](https://en.wikipedia.org/wiki/Agent_systems_reference_model) is a collaborative effort to specify components, requirements, and interactions among the various layers of a multiagent system.  

We motivate the need for a reference model for agent systems in [this paper](/publication/aamas2006).  Software and Reverse Engineering was used to identify common elements among agent frameworks using static and [dynamic analysis](/publication/iadis2007).  We describe the reference model in the context of [United States Army Command and Control (C2) systems](/publication/asc2006), as well as in a [broader context](/publication/smc2009).

Additionally, we have developed an [Agent Systems Reference Architecture (ASRA)](/publication/aose2010) which [further specifies patterns and relationships](/publication/thms2013) among the entities defined by the ASRM.

Download the ASRM [here](http://www.fipa.org/docs/ACIN-reference_model-v1a.pdf).

# Publications
{% for post in site.publications reversed %}
  {% if post.tags contains "asrm" %}
    {% include archive-single.html %}
  {% endif %}
{% endfor %}

# Talks
{% for post in site.talks reversed %}
  {% if post.tags contains "asrm" %}
    {% include archive-single-talk.html %}
  {% endif %}
{% endfor %}