

# # Leaflet cluster map of talk locations
#
# (c) 2016-2017 R. Stuart Geiger, released under the MIT license
#
# Run this from the _talks/ directory, which contains .md files of all your talks. 
# This scrapes the location YAML field from each .md file, geolocates it with
# geopy/Nominatim, and uses the getorg library to output data, HTML,
# and Javascript for a standalone cluster map.
#
# Requires: glob, getorg, geopy

import glob
import getorg
from geopy import Nominatim

g = glob.glob("*.md")


geocoder = Nominatim()
location_dict = {}
location = ""
permalink = ""
title = ""


for file in g:
    with open(file, 'r') as f:
        lines = f.read()
        
        doublequote = False
        singlequote = False
        if lines.find('location: "') > 1:
            doublequote = True
        elif lines.find('location: \'') > 1:
            singlequote = True
            
        if doublequote == True:
            searchstring = 'location: "'
            endstring = '"'
        elif singlequote == True:
            searchstring = 'location: \''
            endstring = '\''
            
        if singlequote == True or doublequote == True:
            loc_start = lines.find(searchstring) + len(searchstring)
            lines_trim = lines[loc_start:]
            loc_end = lines_trim.find(endstring)
            location = lines_trim[:loc_end]
            
        if " and " in location:
            print("Multi-Searching for " + location)
            for l in location.split(" and "):
                print("Searching for " + l)        
                location_dict[l] = geocoder.geocode(l)
                print(l, "\n", location_dict[l])                
        else:
            print("Searching for " + location)        
            location_dict[location] = geocoder.geocode(location)
            print(location, "\n", location_dict[location])


m = getorg.orgmap.create_map_obj()
getorg.orgmap.output_html_cluster_map(location_dict, folder_name="../talkmap", hashed_usernames=False)




