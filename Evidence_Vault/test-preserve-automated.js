/**
 * PRESERVE EVIDENCE DEMO - BROWSER TEST RUNNER
 * 
 * Copy entire contents and paste into browser console (F12)
 * Tests will run automatically and report results
 */

(function() {
  const TESTS = [];
  const RESULTS = { passed: 0, failed: 0, skipped: 0 };
  
  console.clear();
  console.log('🧪 PRESERVE EVIDENCE DEMO - AUTOMATED BROWSER TEST SUITE');
  console.log('=' .repeat(60));
  
  // Helper: Add test
  function test(name, fn) {
    TESTS.push({ name, fn });
  }
  
  // Helper: Assert
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  
  // TEST 1: localStorage API Available
  test('1. LocalStorage API Available', () => {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
  });
  
  // TEST 2: Cases Key Exists
  test('2. Cases Key Exists in localStorage', () => {
    const casesJson = localStorage.getItem('cases');
    assert(typeof casesJson === 'string' || casesJson === null, 
      'Cases key should be string or null');
  });
  
  // TEST 3: Cases JSON is Valid
  test('3. Cases JSON is Valid', () => {
    const casesJson = localStorage.getItem('cases');
    if (casesJson) {
      const cases = JSON.parse(casesJson);
      assert(Array.isArray(cases), 'Cases must be an array');
    }
  });
  
  // TEST 4: Each Case Has Required Fields
  test('4. Each Case Has Required Fields', () => {
    const casesJson = localStorage.getItem('cases');
    if (casesJson) {
      const cases = JSON.parse(casesJson);
      cases.forEach((c, i) => {
        assert(c.id, `Case ${i}: Missing id`);
        assert(c.title, `Case ${i}: Missing title`);
        assert(c.description, `Case ${i}: Missing description`);
        assert(c.createdAt, `Case ${i}: Missing createdAt`);
        assert(Array.isArray(c.evidence), `Case ${i}: Evidence should be array`);
      });
    }
  });
  
  // TEST 5: Case IDs are Unique
  test('5. Case IDs are Unique', () => {
    const casesJson = localStorage.getItem('cases');
    if (casesJson) {
      const cases = JSON.parse(casesJson);
      const ids = cases.map(c => c.id);
      const uniqueIds = new Set(ids);
      assert(ids.length === uniqueIds.size, 'Case IDs should be unique');
    }
  });
  
  // TEST 6: Each Evidence Has Required Fields
  test('6. Each Evidence Record Has Required Fields', () => {
    const casesJson = localStorage.getItem('cases');
    if (casesJson) {
      const cases = JSON.parse(casesJson);
      cases.forEach((c, i) => {
        c.evidence.forEach((e, j) => {
          assert(e.fileName, `Case ${i} Evidence ${j}: Missing fileName`);
          assert(e.clientHash, `Case ${i} Evidence ${j}: Missing clientHash`);
          assert(e.fileSize >= 0, `Case ${i} Evidence ${j}: Invalid fileSize`);
          assert(e.uploadedAt, `Case ${i} Evidence ${j}: Missing uploadedAt`);
        });
      });
    }
  });
  
  // TEST 7: Hash Format is Valid
  test('7. Hash Format is Valid (64 hex chars)', () => {
    const casesJson = localStorage.getItem('cases');
    if (casesJson) {
      const cases = JSON.parse(casesJson);
      cases.forEach((c, i) => {
        c.evidence.forEach((e, j) => {
          const hashRegex = /^[a-f0-9]{64}$/i;
          assert(hashRegex.test(e.clientHash), 
            `Case ${i} Evidence ${j}: Invalid hash format (expected 64 hex chars)`);
        });
      });
    }
  });
  
  // TEST 8: Timestamps are ISO Format
  test('8. Timestamps are ISO Format', () => {
    const casesJson = localStorage.getItem('cases');
    if (casesJson) {
      const cases = JSON.parse(casesJson);
      cases.forEach((c, i) => {
        assert(!isNaN(Date.parse(c.createdAt)), 
          `Case ${i}: createdAt is not valid ISO date`);
        c.evidence.forEach((e, j) => {
          assert(!isNaN(Date.parse(e.uploadedAt)), 
            `Case ${i} Evidence ${j}: uploadedAt is not valid ISO date`);
        });
      });
    }
  });
  
  // TEST 9: Evidence Key Exists
  test('9. Evidence Key Exists (if cases exist)', () => {
    const casesJson = localStorage.getItem('cases');
    const evidenceJson = localStorage.getItem('evidence');
    if (casesJson && JSON.parse(casesJson).length > 0) {
      assert(evidenceJson, 'Evidence key should exist when cases exist');
    }
  });
  
  // TEST 10: Evidence JSON is Valid
  test('10. Evidence JSON is Valid', () => {
    const evidenceJson = localStorage.getItem('evidence');
    if (evidenceJson) {
      const evidence = JSON.parse(evidenceJson);
      assert(Array.isArray(evidence), 'Evidence must be an array');
    }
  });
  
  // TEST 11: Storage Size is Reasonable
  test('11. Storage Size is Reasonable', () => {
    const casesJson = localStorage.getItem('cases') || '';
    const evidenceJson = localStorage.getItem('evidence') || '';
    const totalBytes = casesJson.length + evidenceJson.length;
    const maxBytes = 10 * 1024 * 1024; // 10 MB
    assert(totalBytes < maxBytes, 
      `Storage too large: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  });
  
  // TEST 12: AI Analysis Format (if present)
  test('12. AI Analysis Format is Correct (if present)', () => {
    const casesJson = localStorage.getItem('cases');
    if (casesJson) {
      const cases = JSON.parse(casesJson);
      cases.forEach((c, i) => {
        c.evidence.forEach((e, j) => {
          if (e.aiAnalysis) {
            assert(typeof e.aiAnalysis === 'object', 
              `Case ${i} Evidence ${j}: aiAnalysis should be object`);
            assert(typeof e.aiAnalysis.risk_score === 'number', 
              `Case ${i} Evidence ${j}: risk_score should be number`);
            assert(Array.isArray(e.aiAnalysis.threats), 
              `Case ${i} Evidence ${j}: threats should be array`);
            assert(Array.isArray(e.aiAnalysis.recommendations), 
              `Case ${i} Evidence ${j}: recommendations should be array`);
          }
        });
      });
    }
  });
  
  // TEST 13: Preserved Timestamps Exist
  test('13. Preserved Timestamps Exist (if preserved)', () => {
    const casesJson = localStorage.getItem('cases');
    if (casesJson) {
      const cases = JSON.parse(casesJson);
      cases.forEach((c, i) => {
        c.evidence.forEach((e, j) => {
          if (e.preservedAt) {
            assert(!isNaN(Date.parse(e.preservedAt)), 
              `Case ${i} Evidence ${j}: preservedAt is not valid ISO date`);
          }
        });
      });
    }
  });
  
  // TEST 14: Case Count
  test('14. Report Case Count', () => {
    const casesJson = localStorage.getItem('cases');
    const count = casesJson ? JSON.parse(casesJson).length : 0;
    console.log(`   → Found ${count} case(s) in localStorage`);
  });
  
  // TEST 15: Evidence Count
  test('15. Report Evidence Count', () => {
    const casesJson = localStorage.getItem('cases');
    let totalEvidence = 0;
    if (casesJson) {
      const cases = JSON.parse(casesJson);
      totalEvidence = cases.reduce((sum, c) => sum + c.evidence.length, 0);
    }
    console.log(`   → Found ${totalEvidence} evidence record(s) total`);
  });
  
  // Run all tests
  console.log('\n▶️  Running tests...\n');
  
  TESTS.forEach(({ name, fn }, index) => {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      RESULTS.passed++;
    } catch (error) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${error.message}`);
      RESULTS.failed++;
    }
  });
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${RESULTS.passed}`);
  console.log(`❌ Failed: ${RESULTS.failed}`);
  console.log(`⏭️  Total:  ${RESULTS.passed + RESULTS.failed}`);
  
  if (RESULTS.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Demo mode is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check errors above.');
  }
  
  // Additional Info
  console.log('\n' + '='.repeat(60));
  console.log('📋 STORAGE CONTENT');
  console.log('='.repeat(60));
  
  const casesJson = localStorage.getItem('cases');
  if (casesJson) {
    const cases = JSON.parse(casesJson);
    console.log('\n📁 Cases in localStorage:');
    cases.forEach((c, i) => {
      console.log(`\n${i + 1}. "${c.title}"`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Created: ${new Date(c.createdAt).toLocaleString()}`);
      console.log(`   Evidence: ${c.evidence.length} file(s)`);
      c.evidence.forEach((e, j) => {
        console.log(`     ${j + 1}. ${e.fileName} (${e.fileSize} bytes)`);
        console.log(`        Hash: ${e.clientHash.substring(0, 32)}...`);
      });
    });
  } else {
    console.log('\nℹ️  No cases in localStorage yet');
  }
  
  // Export function
  console.log('\n' + '='.repeat(60));
  console.log('🛠️  UTILITY FUNCTIONS');
  console.log('='.repeat(60));
  
  window.demoUtils = {
    getCases: () => JSON.parse(localStorage.getItem('cases') || '[]'),
    getEvidence: () => JSON.parse(localStorage.getItem('evidence') || '[]'),
    caseCount: () => JSON.parse(localStorage.getItem('cases') || '[]').length,
    clearAll: () => {
      localStorage.clear();
      console.log('✅ All storage cleared. Refresh page.');
    },
    exportData: () => {
      const data = {
        cases: JSON.parse(localStorage.getItem('cases') || '[]'),
        evidence: JSON.parse(localStorage.getItem('evidence') || '[]'),
        exportedAt: new Date().toISOString()
      };
      copy(JSON.stringify(data, null, 2));
      console.log('✅ Data copied to clipboard');
    }
  };
  
  console.log(`
Available functions:
  demoUtils.getCases()      → Get all saved cases
  demoUtils.getEvidence()   → Get all evidence records
  demoUtils.caseCount()     → Get number of cases
  demoUtils.clearAll()      → Clear storage (careful!)
  demoUtils.exportData()    → Copy all data to clipboard
  `);
  
  console.log('='.repeat(60));
  console.log('✨ Test suite complete! Check results above.');
  console.log('='.repeat(60));
  
})();
