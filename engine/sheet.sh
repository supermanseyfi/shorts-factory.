#!/bin/sh
# contact sheet of stills: sheet.sh out.jpg t1 t2 ...
out=$1; shift; in=""; n=0
for t in "$@"; do in="$in -i build/still_$(printf %.2f $t).jpg"; n=$((n+1)); done
ffmpeg -y -loglevel error $in -filter_complex "$(i=0; while [ $i -lt $n ]; do printf "[$i:v]scale=480:-1[v$i];"; i=$((i+1)); done; i=0; while [ $i -lt $n ]; do printf "[v$i]"; i=$((i+1)); done)hstack=inputs=$n" -q:v 3 $out
