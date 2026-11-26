import glob,sys
from PIL import Image,ImageDraw
src=sys.argv[1];tag=sys.argv[2];cols=int(sys.argv[3]) if len(sys.argv)>3 else 3
fs=sorted(glob.glob(src+'/t*.png'))
def sheet(sub,out,cols,scale):
    w,h=int(854*scale),int(480*scale);rows=(len(sub)+cols-1)//cols
    S=Image.new('RGB',(cols*w,rows*h));d=ImageDraw.Draw(S)
    for i,f in enumerate(sub):
        S.paste(Image.open(f).convert('RGB').resize((w,h)),((i%cols)*w,(i//cols)*h));d.text(((i%cols)*w+4,(i//cols)*h+3),f.split('/t')[-1][:-4],fill=(255,255,0))
    S.save(out,quality=85)
n=cols*3
for k in range(0,len(fs),n): sheet(fs[k:k+n],f'qa/prerender/{tag}_{k//n+1}.jpg',cols,.6)
print(len(fs))
