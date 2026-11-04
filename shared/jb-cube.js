// Fixed PLL Jb, yellow U / green F / orange R. Facelets are row-major viewed from outside.
// Prepared with the inverse of: R U R' F' R U R' U' R' F R2 U' R' U'.
export const JB_CUBE_FACES = {
  U: ['yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow'],
  F: ['green', 'orange', 'orange', 'green', 'green', 'green', 'green', 'green', 'green'],
  R: ['blue', 'green', 'green', 'orange', 'orange', 'orange', 'orange', 'orange', 'orange'],
  B: ['orange', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue'],
  L: ['red', 'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red'],
  D: ['white', 'white', 'white', 'white', 'white', 'white', 'white', 'white', 'white'],
};
