// test-nlp.js
const nlpService = require('./src/services/nlpService');

async function testService() {
  try {
    console.log('Testing NLP service with mental health dataset...');
    
    // Wait for the model to load and train
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Analyze a statement with anxiety indicators
    console.log('\n--- Test 1: Anxiety Statement ---');
    const result1 = await nlpService.analyzeJournalEntry(
      "I can't sleep at night and I'm constantly worried about everything."
    );
    console.log('Analysis Result:');
    console.log(JSON.stringify(result1, null, 2));
    
    // Test 2: Analyze a more positive statement
    console.log('\n--- Test 2: Positive Statement ---');
    const result2 = await nlpService.analyzeJournalEntry(
      "I'm feeling much better today after my therapy session. I managed to sleep well."
    );
    console.log('Analysis Result:');
    console.log(JSON.stringify(result2, null, 2));
    
    // Test 3: Test with an actual entry from your dataset
    console.log('\n--- Test 3: Sample from Dataset ---');
    const result3 = await nlpService.analyzeJournalEntry(
      "I feel scared and I haven't slept properly in days."
    );
    console.log('Analysis Result:');
    console.log(JSON.stringify(result3, null, 2));
    
    // Test source/training information
    console.log('\n--- Training Information ---');
    console.log(`Model trained: ${nlpService.mentalHealthModel.trained}`);
    console.log(`Vocabulary size: ${nlpService.mentalHealthModel.vocabulary.size}`);
    
  } catch (error) {
    console.error('Error testing NLP service:', error);
  }
}

testService();