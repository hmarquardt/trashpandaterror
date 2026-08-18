export const CAT_DEFS = [
  { id:'tom', name:'Old Tom', coat:0x9a7655, accent:0xe6d2aa, trust:72, hunger:.78, skittishness:.16, curiosity:.35, noiseTolerance:.9, pace:1.0, approach:[-10,7], preferred:[-2.3,1.8], region:[[-10,7],[-9,4],[-8,9]],
    trait:'Old and unbothered. Eats steady, shrugs off the sprinkler, still checks the reviews for the hose.' },
  { id:'princess', name:'Princess', coat:0xede9df, accent:0x45423f, trust:48, hunger:.66, skittishness:.82, curiosity:.25, noiseTolerance:.18, pace:.62, approach:[10,5], preferred:[1.8,2.4], region:[[8,-6],[9,4],[10,8],[7,-2]],
    trait:'Dainty and picky. Eats slowly, flees at a sneeze, and remembers every startled moment.' },
  { id:'nero', name:'Nero', coat:0x181a19, accent:0x353c39, trust:61, hunger:.7, skittishness:.42, curiosity:.88, noiseTolerance:.55, pace:1.2, approach:[8,-7], preferred:[.2,.6], region:[[-6,-8],[6,-8],[10,2],[-10,1],[4,10]],
    trait:'Nosy gobbler. Eats fast, investigates the sprinkler, and will absolutely charge straight at a hose splash.' }
];

export const GARY_DEF = {
  id:'gary', name:'Gary', coat:0x9aa19b, accent:0x1a1c1b, trust:0,
  hunger:.9, boldness:.72, intelligence:.58, strength:.8, curiosity:.74,
  approach:[-9,-8]
};

export const KIT_DEF = {
  id:'kit', name:'Lil Rascal', coat:0x8b908b, accent:0x1c1e1e, trust:0,
  hunger:.55, boldness:.28, intelligence:.16, strength:.35, curiosity:1,
  pace:1.6, appetite:.5, fedTarget:.12, fearMult:1.6, approach:[9,5],
  trait:'Gary’s kid. Fast, careless, and magnetically drawn to trouble.'
};

export const RATINGS = [
  { min:92, grade:'S', title:'CAT FORTRESS' }, { min:80, grade:'A', title:'RACCOON RESISTANT' },
  { min:65, grade:'B', title:'MOSTLY CAT FOOD' }, { min:45, grade:'C', title:'SHARED DINNER' },
  { min:22, grade:'D', title:'RACCOON BUFFET' }, { min:0, grade:'F', title:'YOU FED THE RACCOONS' }
];
