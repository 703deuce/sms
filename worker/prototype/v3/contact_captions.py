"""Captioned contact sheet: 8 frames at the middle of different words. usage: python contact_captions.py vertical.mp4 [out.jpg]"""
import sys, os, json, cv2, numpy as np
vid = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(vid)[0] + '_captions_contact.jpg'
W = json.load(open(os.path.splitext(vid)[0] + '.words.json'))
cap = cv2.VideoCapture(vid); fps = cap.get(cv2.CAP_PROP_FPS); tiles = []
# pick 8 words spread over the clip, preferring both speakers
idx = list(np.linspace(3, len(W) - 3, 8).astype(int))
r1 = [i for i, w in enumerate(W) if w['spk'] == 1]
if r1 and not any(W[i]['spk'] == 1 for i in idx): idx[0] = r1[len(r1) // 2]
for i in sorted(idx):
    w = W[i]; t = (w['s'] + w['e']) / 2
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps)); ok, fr = cap.read()
    fr = cv2.resize(fr, (360, 640))
    cv2.rectangle(fr, (0, 0), (360, 30), (0, 0, 0), -1)
    cv2.putText(fr, f"{t:5.1f}s '{w['w']}' {'LR'[w['spk']]}", (6, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    tiles.append(fr)
sheet = np.vstack([np.hstack(tiles[:4]), np.hstack(tiles[4:])]); cv2.imwrite(out, sheet, [cv2.IMWRITE_JPEG_QUALITY, 85]); print(out)
