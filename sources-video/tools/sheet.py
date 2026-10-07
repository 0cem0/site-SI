import sys, glob
from PIL import Image
files = sys.argv[2:]
cols = 2
ims = [Image.open(f).resize((960, 540)) for f in files]
rows = (len(ims) + cols - 1) // cols
sh = Image.new('RGB', (960 * cols, 540 * rows), 'white')
for i, im in enumerate(ims): sh.paste(im, ((i % cols) * 960, (i // cols) * 540))
sh.save(sys.argv[1], quality=85)
