#!/usr/bin/env node

/**
 * PRESERVE EVIDENCE DEMO - INTEGRATION TEST SCRIPT
 * 
 * This script validates the LocalStorage implementation
 * Run in browser console after testing the UI
 */

console.log('🧪 PRESERVE EVIDENCE DEMO - TEST SUITE');
console.log('=====================================\n');

// Test 1: Check LocalStorage API
console.log('TEST 1: LocalStorage Available');
try {
  const test = '__test__';
  localStorage.setItem(test, test);
  localStorage.removeItem(test);
  console.log('✅ LocalStorage working\n');
} catch (e) {
  console.log('❌ LocalStorage not available:', e.message);
  console.log('   (Running in private mode?)\n');
}

// Test 2: Check existing cases
console.log('TEST 2: Check Saved Cases');
try {
  const casesJson = localStorage.getItem('cases');
  if (casesJson) {
    const cases = JSON.parse(casesJson);
    console.log(`✅ Found ${cases.length} case(s):`);
    cases.forEach((c, i) => {
      console.log(`   ${i + 1}. "${c.title}" (ID: ${c.id})`);
      console.log(`      Created: ${new Date(c.createdAt).toLocaleString()}`);
      console.log(`      Evidence count: ${c.evidence.length}`);
    });
  } else {
    console.log('ℹ️  No cases found (empty localStorage)\n');
  }
} catch (e) {
  console.log('❌ Error parsing cases:', e.message, '\n');
}

// Test 3: Check evidence metadata
console.log('\nTEST 3: Check Evidence Metadata');
try {
  const evidenceJson = localStorage.getItem('evidence');
  if (evidenceJson) {
    const evidence = JSON.parse(evidenceJson);
    console.log(`✅ Found ${evidence.length} evidence record(s):`);
    evidence.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.fileName}`);
      console.log(`      Hash: ${e.clientHash.substring(0, 16)}...`);
      console.log(`      Size: ${(e.fileSize / 1024 / 1024).toFixed(2)} MB`);
      if (e.aiAnalysis) {
        console.log(`      Risk Score: ${e.aiAnalysis.risk_score}/10`);
      }
    });
  } else {
    console.log('ℹ️  No evidence records found\n');
  }
} catch (e) {
  console.log('❌ Error parsing evidence:', e.message, '\n');
}

// Test 4: Data integrity
console.log('\nTEST 4: Data Integrity Check');
try {
  const casesJson = localStorage.getItem('cases');
  const cases = casesJson ? JSON.parse(casesJson) : [];
  
  let integrityOk = true;
  
  cases.forEach((c, i) => {
    // Check required fields
    const required = ['id', 'title', 'description', 'createdAt', 'evidence'];
    required.forEach(field => {
      if (!c[field]) {
        console.log(`❌ Case ${i + 1}: Missing field "${field}"`);
        integrityOk = false;
      }
    });
    
    // Check evidence structure
    if (Array.isArray(c.evidence)) {
      c.evidence.forEach((e, j) => {
        const evRequired = ['id', 'fileName', 'clientHash', 'uploadedAt'];
        evRequired.forEach(field => {
          if (!e[field]) {
            console.log(`❌ Case ${i + 1} Evidence ${j + 1}: Missing "${field}"`);
            integrityOk = false;
          }
        });
      });
    }
  });
  
  if (integrityOk && cases.length > 0) {
    console.log('✅ All cases have correct structure\n');
  } else if (cases.length === 0) {
    console.log('ℹ️  No cases to verify\n');
  }
} catch (e) {
  console.log('❌ Integrity check failed:', e.message, '\n');
}

// Test 5: Storage size
console.log('TEST 5: Storage Size');
try {
  const casesJson = localStorage.getItem('cases') || '';
  const evidenceJson = localStorage.getItem('evidence') || '';
  const totalSize = casesJson.length + evidenceJson.length;
  const sizeKb = (totalSize / 1024).toFixed(2);
  
  console.log(`✅ Used storage: ${sizeKb} KB`);
  console.log(`   (Typical limit: 5-10 MB)\n`);
} catch (e) {
  console.log('❌ Size check failed:', e.message, '\n');
}

// Test 6: JSON validity
console.log('TEST 6: JSON Validity');
try {
  const casesValid = !localStorage.getItem('cases') || JSON.parse(localStorage.getItem('cases'));
  const evidenceValid = !localStorage.getItem('evidence') || JSON.parse(localStorage.getItem('evidence'));
  
  console.log('✅ Cases JSON: Valid');
  console.log('✅ Evidence JSON: Valid\n');
} catch (e) {
  console.log('❌ JSON Parsing Error:', e.message);
  console.log('   LocalStorage may be corrupted\n');
}

// Test 7: Helper functions
console.log('TEST 7: Utility Functions Available');
console.log(`
Helper commands for debugging:

// Get all cases
JSON.parse(localStorage.getItem('cases') || '[]')

// Get specific case
JSON.parse(localStorage.getItem('cases') || '[]').find(c => c.title === "Title")

// Count cases
JSON.parse(localStorage.getItem('cases') || '[]').length

// Get all evidence
JSON.parse(localStorage.getItem('evidence') || '[]')

// Clear all data (CAREFUL!)
localStorage.clear()
location.reload()

// Export data as JSON
copy(JSON.stringify(JSON.parse(localStorage.getItem('cases')), null, 2))

// Check storage quota
console.log('Check browser DevTools → Application → Storage for quota info')
`);

// Summary
console.log('\n=====================================');
console.log('📊 SUMMARY');
console.log('=====================================');

try {
  const cases = JSON.parse(localStorage.getItem('cases') || '[]');
  const evidence = JSON.parse(localStorage.getItem('evidence') || '[]');
  
  console.log(`Cases saved: ${cases.length}`);
  console.log(`Evidence records: ${evidence.length}`);
  console.log(`Total storage: ${((localStorage.getItem('cases')?.length || 0) / 1024).toFixed(2)} KB`);
  console.log('\n✅ Demo is working - Ready for full testing!');
} catch (e) {
  console.log('❌ Error reading storage');
}

console.log('\nFor detailed test guide, see: PRESERVE_EVIDENCE_DEMO_FIX.md');
