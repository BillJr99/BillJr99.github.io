---
title: "RoadClosures GIS"
excerpt: "A decision-support GIS tool for fire and police incident response: given an incident location, it recommends which hydrant to use, how to route the hose, which roads to close, and where to place MUTCD-compliant warning signs and channelizing devices — using graph algorithms over real road-network data."
collection: software
comments: true
tags:
  - gis
  - graph algorithms
  - optimization
  - public safety
  - python
  - react
---

RoadClosures GIS is a decision-support tool that helps fire and police personnel plan a safe perimeter around an emergency scene. When an incident occurs, responders have to answer a cluster of related questions quickly: which fire hydrant should we draw from, how should the hose run from that hydrant to the scene, which roads do we close to protect crews and equipment, and where do we put the advance warning signs and cones so that drivers have time to see and respond to the closure? This application takes an incident location and produces a concrete, explainable recommendation for all of those decisions at once, while respecting the limited number of barricades, signs, and devices a crew actually has on hand.

The core of the tool models the road network as a graph and applies classic graph and network-flow algorithms to it. To choose a hydrant, it snaps the incident and nearby hydrants onto the road graph and computes shortest paths, scoring candidate hydrants by a combination of hose-run length, how much the route bends (curvature), and the road grade — preferring a hydrant that gives a shorter, straighter, flatter hose run, and reporting *why* one hydrant won. To choose road closures, it builds a flow network around the incident and computes a minimum cut, which identifies the least-disruptive set of roads that still separates through-traffic from the scene; the hose route itself is protected so it is never cut, and closure costs are weighted by road class and by distance from the incident to keep the cordon tight. It then places advance warning signs and channelizing-device tapers (cones and drums) following MUTCD spacing and geometry guidance, so the recommended traffic-control plan matches what crews are trained to deploy.

The system is built as a Python (FastAPI) back end paired with a React and TypeScript front end. The back end leans on the established geospatial and graph stack — GeoPandas and Shapely for spatial data, NetworkX for shortest-path and minimum-cut computation, and OSMnx for pulling and working with road-network data — and exposes its planner over a small REST API. The front end renders the map and the resulting plan interactively with Leaflet, letting a planner see the recommended hydrant, hose route, closures, and signage on the map and adjust available-resource limits to see how the plan cascades.

This project is the software realization of ongoing research into using graph optimization to facilitate rapid emergency response. The repository is currently private, so there is no public link at this time.
