#!/usr/bin/env node

/**
 * Test script for Evidence Upload Module refactoring
 * Tests all three buttons and error scenarios
 * Run: node test-evidence-upload.js
 */

const BASE_URL = 'http://localhost:3000';

const tests = [];

// Test 1: Verify /api/analyze endpoint exists
tests.push({
  name: 'Test 1: Check /api/analyze endpoint exists',
  fn: async () => {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Case',
        description: 'Testing AI analysis endpoint'
      })
    });
    
    if (res.status === 500 && res.headers.get('content-type')?.includes('json')) {
      console.log('✓ Endpoint exists (returns 500 - likely API key issue, which is OK for this test)');
      return true;
    } else if (res.status === 404) {
      console.log('✗ FAIL: Endpoint not found (404). Check /api/analyze is defined in server.ts');
      return false;
    } else if (res.ok) {
      console.log('✓ Endpoint exists and returns success');
      return true;
    } else {
      console.log(`? Unexpected status: ${res.status}`);
      return false;
    }
  }
});

// Test 2: Verify /api/cases endpoint exists
tests.push({
  name: 'Test 2: Check /api/cases endpoint exists',
  fn: async () => {
    const res = await fetch(`${BASE_URL}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Case',
        description: 'Testing case creation'
      })
    });
    
    if (res.status === 404) {
      console.log('✗ FAIL: Endpoint not found (404)');
      return false;
    } else {
      console.log('✓ Endpoint exists');
      return true;
    }
  }
});

// Test 3: Verify /api/preserve endpoint exists
tests.push({
  name: 'Test 3: Check /api/preserve endpoint exists',
  fn: async () => {
    const res = await fetch(`${BASE_URL}/api/preserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evidenceId: 'test-id',
        caseId: 'test-case',
        serverHash: 'abc123'
      })
    });
    
    if (res.status === 404) {
      console.log('✗ FAIL: Endpoint not found (404)');
      return false;
    } else {
      console.log('✓ Endpoint exists');
      return true;
    }
  }
});

// Test 4: Check /api/analyze error handling (missing params)
tests.push({
  name: 'Test 4: /api/analyze error handling (missing params)',
  fn: async () => {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Case'
        // missing description
      })
    });
    
    if (res.status === 400) {
      const data = await res.json();
      if (data.error && data.error.includes('required')) {
        console.log('✓ Properly rejects missing parameters');
        return true;
      }
    }
    console.log('✗ Should return 400 for missing parameters');
    return false;
  }
});

// Test 5: Check /api/analyze responds with correct structure (when API fails)
tests.push({
  name: 'Test 5: /api/analyze error response structure',
  fn: async () => {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test',
        description: 'Test'
      })
    });
    
    const data = await res.json();
    
    if (res.status === 500) {
      // Expected: API key not set
      if (data.error && data.details) {
        console.log('✓ Error response has correct structure (error + details)');
        return true;
      }
    } else if (res.status === 200 && data.success) {
      console.log('✓ Success response structure correct');
      return true;
    }
    
    console.log('✗ Response structure incorrect');
    return false;
  }
});

// Run all tests
async function runTests() {
  console.log('\n🧪 Evidence Upload Module Tests\n');
  console.log(`Testing: ${BASE_URL}\n`);
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n${test.name}`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (err: any) {
      console.log(`✗ EXCEPTION: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n\n📊 Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. See details above.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
