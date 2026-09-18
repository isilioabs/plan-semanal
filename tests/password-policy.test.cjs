const test=require('node:test');
const assert=require('node:assert/strict');

test('new password requires eight characters, uppercase, lowercase, number and punctuation',async()=>{
 const {validNewPassword}=await import('../src/workspace/password-policy.mjs');
 for(const value of ['Abcdef1.','Abcdef1!'])assert.equal(validNewPassword(value),true);
 for(const value of ['ABCDEF1.','Abcde1.','abcdef1.','Abcdefg.','Abcdef12','Abcdef1 ','Abcdef1é',''])assert.equal(validNewPassword(value),false);
});
