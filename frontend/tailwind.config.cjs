// Mapping optionnel du thème Cicero ; le frontend natif utilise directement le CSS.
module.exports = {
  content:['./frontend/**/*.{html,js}'],
  theme:{extend:{
    colors:{
      paper:'var(--paper)',surface:{DEFAULT:'var(--surface)',secondary:'var(--surface-2)'},
      line:{DEFAULT:'var(--line)',strong:'var(--line-strong)'},
      ink:{DEFAULT:'var(--ink)',deep:'var(--ink-deep)',soft:'var(--ink-soft)',faint:'var(--ink-faint)'},
      signal:{DEFAULT:'var(--signal)',hover:'var(--signal-hover)',bg:'var(--signal-bg)'},
      conflict:{DEFAULT:'var(--conflict)',text:'var(--conflict-text)',bg:'var(--conflict-bg)'},
      gap:{DEFAULT:'var(--gap)',text:'var(--gap-text)',bg:'var(--gap-bg)'},
      duplicate:{DEFAULT:'var(--duplicate)',text:'var(--duplicate-text)',bg:'var(--duplicate-bg)'},
      obsolete:{DEFAULT:'var(--obsolete)',text:'var(--obsolete-text)',bg:'var(--obsolete-bg)'},
      resolved:{DEFAULT:'var(--resolved)',text:'var(--resolved-text)',bg:'var(--resolved-bg)'}
    },
    fontFamily:{serif:['var(--font-serif)'],sans:['var(--font-sans)'],mono:['var(--font-mono)']},
    borderRadius:{input:'24px',card:'16px',pill:'999px'},
    boxShadow:{soft:'var(--shadow-soft)',hover:'var(--shadow-hover)'}
  }}
};
