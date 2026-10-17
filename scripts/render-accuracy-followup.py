"""Scientific before/after figure from the controlled quadrature experiment."""
import json,os
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parents[1];folder=root/os.environ.get('ACCURACY_DIR','.release/accuracy-followup');r=json.loads((folder/'quadrature-comparison.json').read_text());records=r['records'];fig,ax=plt.subplots(figsize=(10,4.6),layout='constrained')
for i,q in enumerate(records):
 x=max(q['afterRelative'],1e-16);y=max(q['beforeRelative'],1e-16);ax.plot([x,y],[i,i],color='#aab8c1',lw=2);ax.scatter(y,i,c='#b4531c',s=45,label='Fixed linear quadrature' if i==0 else None);ax.scatter(x,i,c='#185c85',s=45,marker='s',label='Adaptive cubic quadrature' if i==0 else None)
ax.set(yticks=range(len(records)),yticklabels=[f"{q['T']:.10g} K / {q['phase']}" for q in records],xscale='log',xlabel='Relative error in isobaric heat capacity vs independent 70/90-digit reference',title='IAPWS-95 coexistence: controlled quadrature comparison');ax.invert_yaxis();ax.grid(True,axis='x',which='both',alpha=.2);ax.legend(loc='lower right');fig.savefig(folder/'quadrature-improvement.png',dpi=160);fig.savefig(folder/'quadrature-improvement.pdf');plt.close(fig)
