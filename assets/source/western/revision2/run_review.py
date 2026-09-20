"""One bounded, serial Blender process for source and complete visual evidence."""
import sys,json
from pathlib import Path
root=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(root/'scripts/assets'))
import rebuild_roster_v2 as recipe
for species in ['lion','wolf','unicorn']:
 for form in ['race','upright']:
  recipe.inspect(species,form)
  sample=recipe.OUT/f'{species}-{form}-motion-samples.json'
  completed='--resume' in sys.argv and sample.exists() and all(row['sourceSha256']==recipe.digest(recipe.OUT/('candidate' if row['variant']=='candidate' else 'inputs')/recipe.filename(species,form,'blend')) for row in json.loads(sample.read_text()))
  if not completed:
   recipe.preview(species,form)
   recipe.materialproof(species,form)
   recipe.motion(species,form)
  recipe.package(species,form)
print('REVISION2_COMPLETE_REVIEW_RENDERED',flush=True)
