import sys, json; sys.path.insert(0,'/opt/agent/ops'); from oh import api
msg=("Rick: stop here and deliver exactly what you have right now, as-is. Render or export the current cut at 480p into out/ "
     "even if it is partial or rough (use whatever scenes, footage, voiceover and frames already exist; skip anything not built yet), "
     "plus copy the existing scene renders and a few key frames into out/. Do not polish, research or fix anything further. "
     "Then reply with the path of the MP4 and a one-line list of what is missing.")
print(api('POST','/api/conversations/4b794183-c64e-440c-89d5-6311f646ee61/events',
          {'role':'user','content':[{'type':'text','text':msg}],'run':True}, timeout=1800))
