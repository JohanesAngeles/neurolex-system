// server/src/services/nlpService.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const natural = require('natural');
const { TfIdf } = natural;
const tokenizer = new natural.WordTokenizer();

class NLPService {
  constructor() {
    this.API_URL = "https://api-inference.huggingface.co/models/";
    // huugging face API key
    this.API_KEY = process.env.HUGGING_FACE_API_KEY;
    
    
    this.models = {
      sentiment: "CardiffNLP/twitter-roberta-base-sentiment", 
      emotion: "j-hartmann/emotion-english-distilroberta-base", 
      summarization: "facebook/bart-large-cnn" 
    };

    // Initialize mental health specific sentiment analysis
    this.mentalHealthModel = {
      vocabulary: new Map(),
      categories: ['positive', 'negative', 'neutral', 'anxiety'], 
      categoryWeights: {
        'positive': new Map(),
        'negative': new Map(),
        'neutral': new Map(),
        'anxiety': new Map()
      },
      trained: false
    };

    // Path to downloaded dataset
    this.datasetPath = path.join(__dirname, '../data/Combined Data.csv');
    
    // Load and train the custom model
    this.loadDatasetAndTrainModel();

    // Mental health specific keywords and weights
    this.mentalHealthKeywords = {
      depression: ['depressed', 'sad', 'hopeless', 'worthless', 'empty', 'grief', 'despair'],
      anxiety: ['anxious', 'worried', 'nervous', 'panic', 'fear', 'stress', 'tense'],
      trauma: ['trauma', 'flashback', 'nightmare', 'scared', 'terrified', 'unsafe'],
      suicidal: ['suicide', 'kill myself', 'end it all', 'no reason to live', 'better off dead'],
      positive: [
        'happy', 'hopeful', 'grateful', 'proud', 'relaxed', 'calm', 'peaceful',
        'comforting', 'worthy', 'beautifully', 'trust', 'strength', 'warmth', 
        'laughter', 'peace', 'beauty', 'patience', 'understanding', 'care', 
        'kindness', 'nourishing', 'gentle', 'best', 'enough', 'growth'
      ],
      improvement: ['better', 'improving', 'progress', 'hope', 'trying', 'recovery']
    };
  }

  async loadDatasetAndTrainModel() {
    // Check if dataset file exists
    try {
      if (fs.existsSync(this.datasetPath)) {
        console.log('Loading mental health sentiment dataset...');
        await this._trainFromDataset();
      } else {
        console.warn(`Dataset file not found at ${this.datasetPath}. Using fallback sentiment analysis.`);
      }
    } catch (error) {
      console.error('Error loading dataset:', error);
      console.log('Using fallback sentiment analysis methods.');
    }
  }

  async _trainFromDataset() {
    try {
      const results = [];
      
      // Parse CSV file and collect data
      await new Promise((resolve, reject) => {
        fs.createReadStream(this.datasetPath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      if (results.length === 0) {
        console.warn('No data found in dataset.');
        return;
      }

      console.log(`Training on ${results.length} samples from mental health dataset...`);

      // Based on your CSV, identify the correct column names
      const textColumn = 'statement';  // This is where the text content is
      const labelColumn = 'status';    // This is where the sentiment/status label is

      // Map dataset labels to our categories
      const labelMapping = {
        'normal': 'positive',
        'depression': 'negative',
        'suicidal': 'negative',
        'anxiety': 'anxiety',
        'stress': 'negative',
        'bipolar': 'negative',
        'personality disorder': 'negative'
      };

      // Build vocabulary and calculate term frequencies
      const tfidf = new TfIdf();
      
      results.forEach((row, index) => {
        const text = row[textColumn];
        let rawLabel = row[labelColumn]?.toLowerCase();
        let label = labelMapping[rawLabel] || 'neutral';
        
        // Tokenize and add to TF-IDF
        if (text) {
          const tokens = tokenizer.tokenize(text.toLowerCase());
          tfidf.addDocument(tokens, `doc_${index}`);
          
          // Add to vocabulary with label association
          tokens.forEach(token => {
            if (!this.mentalHealthModel.vocabulary.has(token)) {
              this.mentalHealthModel.vocabulary.set(token, new Map());
            }
            
            const tokenStats = this.mentalHealthModel.vocabulary.get(token);
            tokenStats.set(label, (tokenStats.get(label) || 0) + 1);
          });
        }
      });
      
      // Calculate weights for each term in each category
      for (const [token, labelCounts] of this.mentalHealthModel.vocabulary.entries()) {
        const totalMentions = Array.from(labelCounts.values()).reduce((sum, count) => sum + count, 0);
        
        for (const category of this.mentalHealthModel.categories) {
          const count = labelCounts.get(category) || 0;
          if (count > 0) {
            // Calculate weight based on frequency in this category
            const weight = count / totalMentions;
            this.mentalHealthModel.categoryWeights[category].set(token, weight);
          }
        }
      }
      
      this.mentalHealthModel.trained = true;
      console.log('Mental health sentiment model trained successfully.');
    } catch (error) {
      console.error('Error training from dataset:', error);
    }
  }

  // UPDATED: Now properly checking API key and handling errors
  async analyzeSentiment(text) {
    try {
      // Check if the API key is set
      if (!this.API_KEY) {
        console.error('HUGGING_FACE_API_KEY not found or is empty. Check your .env file.');
        throw new Error('Hugging Face API key is not configured');
      }

      // Check for explicit mood indicators first - these override everything
      if (text.toLowerCase().includes('quick mood: positive') || 
          text.toLowerCase().includes('mood: positive')) {
        console.log('Explicit positive mood detected in text, overriding sentiment analysis');
        return {
          sentiment: { 
            type: 'positive', 
            score: 90, 
            confidence: 0.9
          },
          source: 'explicit-mood-indicator'
        };
      }
      
      // Try Hugging Face API first
      console.log('Trying Hugging Face sentiment model as primary analysis method');
      console.log(`Using API endpoint: ${this.API_URL}${this.models.sentiment}`);
      console.log(`API Key (first 4 chars): ${this.API_KEY.substring(0, 4)}...`);
      
      const response = await axios({
        url: this.API_URL + this.models.sentiment,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: { inputs: text },
        timeout: 10000 // 10 second timeout
      });

      console.log('Hugging Face sentiment API response received:', response.status);
      console.log('Response data:', JSON.stringify(response.data).substring(0, 200));
      
      // Extract and enhance the sentiment
      const baseResult = this._extractSentiment(response.data);
      console.log('Extracted base sentiment:', baseResult);
      
      const enhancedResult = this._enhanceWithDomainKnowledge(text, baseResult);
      console.log('Enhanced sentiment result:', enhancedResult);
      
      return {
        sentiment: enhancedResult,
        rawResponse: response.data,
        source: 'huggingface-api'
      };
    } catch (error) {
      console.error('Error with Hugging Face sentiment API:', error.message);
      
      // Log more detailed error information
      if (error.response) {
        console.error('API Response Error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('No response received from API');
      }
      
      // Fall back to custom model if Hugging Face fails
      if (this.mentalHealthModel.trained) {
        console.log('Falling back to custom dataset model for sentiment analysis');
        const customSentiment = this._analyzeWithCustomModel(text);
        return {
          sentiment: customSentiment,
          source: 'custom-dataset-fallback'
        };
      }
      
      // Ultimate fallback if both methods fail - RETURN VARIED SENTIMENTS
      // This ensures we don't always return 'positive'
      console.log('Using basic rule-based fallback sentiment analysis');
      
      // Simple rule-based approach to vary the sentiment
      const lowercaseText = text.toLowerCase();
      if (lowercaseText.includes('sad') || 
          lowercaseText.includes('unhappy') || 
          lowercaseText.includes('depressed') ||
          lowercaseText.includes('anxious') ||
          lowercaseText.includes('worried')) {
        return {
          sentiment: { type: 'negative', score: 70, confidence: 0.7 },
          error: error.message,
          source: 'rule-based-fallback'
        };
      } else if (lowercaseText.includes('happy') || 
                lowercaseText.includes('great') ||
                lowercaseText.includes('joy') ||
                lowercaseText.includes('excited')) {
        return {
          sentiment: { type: 'positive', score: 75, confidence: 0.75 },
          error: error.message,
          source: 'rule-based-fallback'
        };
      } else {
        return {
          sentiment: { type: 'neutral', score: 50, confidence: 0.5 },
          error: error.message,
          source: 'rule-based-fallback'
        };
      }
    }
  }

  _analyzeWithCustomModel(text) {
    if (!this.mentalHealthModel.trained) {
      return { type: 'neutral', score: 50, confidence: 0.5 };
    }
    
    // Tokenize input text
    const tokens = tokenizer.tokenize(text.toLowerCase());
    
    // Calculate score for each category
    const scores = {};
    let totalScore = 0;
    
    for (const category of this.mentalHealthModel.categories) {
      scores[category] = 0;
      
      for (const token of tokens) {
        if (this.mentalHealthModel.categoryWeights[category].has(token)) {
          scores[category] += this.mentalHealthModel.categoryWeights[category].get(token);
        }
      }
      
      totalScore += scores[category];
    }
    
    // Normalize scores
    if (totalScore > 0) {
      for (const category in scores) {
        scores[category] = (scores[category] / totalScore) * 100;
      }
    }
    
    // Determine the dominant sentiment
    let maxScore = 0;
    let dominantType = 'neutral';
    
    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        dominantType = category;
      }
    }
    
    // Map anxiety to negative for compatibility with the rest of the system
    if (dominantType === 'anxiety') {
      dominantType = 'negative';
      // Add anxiety as a flag
      return {
        type: dominantType,
        score: maxScore,
        confidence: maxScore / 100,
        flags: ['anxiety']
      };
    }
    
    // Apply additional mental health domain knowledge
    const enhancedResult = this._enhanceWithDomainKnowledge(text, {
      type: dominantType,
      score: maxScore,
      confidence: maxScore / 100
    });
    
    return enhancedResult;
  }

  // Update the _enhanceWithDomainKnowledge method in nlpService.js
// This method overrides the Hugging Face API when necessary for mental health contexts

_enhanceWithDomainKnowledge(text, result) {
  const lowerText = text.toLowerCase();
  let adjustmentFactor = 0;
  
  // Check for suicidal ideation - this should take highest priority
  if (this.mentalHealthKeywords.suicidal.some(keyword => lowerText.includes(keyword))) {
    return {
      type: 'negative',
      score: 95,
      confidence: 0.95,
      flags: ['suicidal_ideation', 'urgent']
    };
  }
  
  // Mental health specific keywords that should trigger a sentiment adjustment
  // Add more domain-specific terms that should override the general sentiment model
  const mentalHealthContextKeywords = {
    negative: [
      'overwhelmed', 'struggles', 'distraction', 'uncertain', 'tired', 
      'not enough', 'weakness', 'perfectly', 'have to do everything', 
      'feels full', 'trying to'
    ],
    anxiety: [
      'anxiety', 'anxious', 'worried', 'nervous', 'panic', 
      'stress', 'tense', 'uncertain', 'tired'
    ],
    trauma: [
      'trauma', 'flashback', 'nightmare', 'scared', 'terrified', 'unsafe'
    ],
    positive_resilience: [
      'breathing', 'patience', 'remind myself', 'allowed to take',
      'strength', 'grace', 'intentionally'
    ]
  };
  
  // Count mental health context keywords
  let negativeCount = 0;
  let positiveCount = 0;
  let anxietyCount = 0;
  
  // Check for negative mental health context
  for (const keyword of mentalHealthContextKeywords.negative) {
    if (lowerText.includes(keyword)) {
      negativeCount++;
      adjustmentFactor -= 10; // Make more negative
    }
  }
  
  // Check for anxiety mental health context
  for (const keyword of mentalHealthContextKeywords.anxiety) {
    if (lowerText.includes(keyword)) {
      anxietyCount++;
      adjustmentFactor -= 8; // Make more negative
    }
  }
  
  // Check for positive resilience factors (these are positive but in a mental health context)
  for (const keyword of mentalHealthContextKeywords.positive_resilience) {
    if (lowerText.includes(keyword)) {
      positiveCount++;
      // Only slightly positive impact since these often appear in coping contexts
      adjustmentFactor += 5; 
    }
  }
  
  // Check for specific phrases that indicate mental health struggles
  // These are common in therapy contexts but might sound positive to general models
  if (lowerText.includes('i took a few quiet moments') ||
      lowerText.includes('reminded myself') ||
      lowerText.includes('breathe') ||
      (lowerText.includes('perfectly') && lowerText.includes('worthy'))) {
    console.log('Detected therapeutic/coping language typical of mental health contexts');
    // These are actually coping strategies, not necessarily "positive" sentiment
    adjustmentFactor -= 20;
  }
  
  // CRITICAL: Check for specific mental health clinical patterns
  // In mental health contexts, sometimes people use positive-sounding language
  // to describe coping with negative emotions
  
  // Self-reassurance pattern - often indicates underlying struggle
  if ((lowerText.includes('remind') || lowerText.includes('reminded')) && 
      (lowerText.includes('myself') || lowerText.includes('that i'))) {
    console.log('Detected self-reassurance pattern - likely indicates underlying struggle');
    adjustmentFactor -= 25; // This is a strong indicator of mental health work
  }
  
  // Permission-giving pattern - indicates struggle with self-compassion
  if (lowerText.includes('allowed to') || 
      (lowerText.includes('enough') && !lowerText.includes('not enough'))) {
    console.log('Detected permission-giving pattern - indicates self-compassion work');
    adjustmentFactor -= 20;
  }
  
  // Self-care intention pattern - often a response to negative state
  if (lowerText.includes('be kind to myself') || 
      lowerText.includes('self-care') || 
      lowerText.includes('take space')) {
    console.log('Detected self-care intention pattern');
    adjustmentFactor -= 15;
  }
  
  // Mental health specific flags
  let flags = [];
  
  // Add original mental health keyword detection (from the existing method)
  let originalPositiveCount = 0;
  let originalNegativeCount = 0;
  
  for (const [category, keywords] of Object.entries(this.mentalHealthKeywords)) {
    if (category === 'suicidal') continue; // Already handled
    
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        if (['depression', 'anxiety', 'trauma'].includes(category)) {
          adjustmentFactor -= 5; // More negative (less impact than specialized detection above)
          originalNegativeCount++;
          flags.push(category);
        } else if (['positive', 'improvement'].includes(category)) {
          adjustmentFactor += 5; // More positive (less impact than specialized detection above)
          originalPositiveCount++;
          flags.push(category);
        }
      }
    }
  }
  
  console.log(`Mental health content analysis: Negative=${negativeCount}, Anxiety=${anxietyCount}, Positive=${positiveCount}, AdjustmentFactor=${adjustmentFactor}`);
  
  // Determine final sentiment type based on the enhanced context
  let newType = result.type;
  let newScore = result.score;
  
  // Major override for therapeutic/mental health content
  // If we have significant mental health keywords but the sentiment is positive
  if (result.type === 'positive' && (negativeCount + anxietyCount > 3 || adjustmentFactor < -30)) {
    console.log('Overriding positive sentiment due to mental health context indicators');
    newType = anxietyCount > negativeCount ? 'neutral' : 'negative';
    newScore = Math.min(100, Math.max(0, 50 + adjustmentFactor));
    flags.push('mental_health_context');
  } 
  // If we have mostly positive resilience/coping language but the sentiment is negative
  else if (result.type === 'negative' && positiveCount > (negativeCount + anxietyCount) * 1.5) {
    console.log('Adjusting negative sentiment due to resilience indicators');
    newType = 'neutral';
    newScore = Math.min(100, Math.max(0, 50 + adjustmentFactor));
    flags.push('resilience');
  }
  // For neutral sentiment, let the context indicators push it one way or the other
  else if (result.type === 'neutral') {
    if (adjustmentFactor < -20) {
      newType = 'negative';
      newScore = Math.min(100, Math.max(0, 40 + adjustmentFactor));
    } else if (adjustmentFactor > 20) {
      newType = 'positive';
      newScore = Math.min(100, Math.max(0, 60 + adjustmentFactor));
    } else {
      newScore = Math.min(100, Math.max(0, newScore + adjustmentFactor));
    }
  }
  // Otherwise just adjust the score within the original sentiment type
  else {
    newScore = Math.min(100, Math.max(0, newScore + adjustmentFactor));
  }
  
  return {
    type: newType,
    score: Math.round(newScore),
    confidence: newScore / 100,
    flags: flags.length > 0 ? [...new Set(flags)] : undefined // Remove duplicates
  };
}

  async analyzeEmotion(text) {
    try {
      // Check if API key is configured
      if (!this.API_KEY) {
        throw new Error('Hugging Face API key is not configured');
      }
      
      console.log(`Calling Hugging Face API for emotion analysis with model: ${this.models.emotion}`);
      
      const response = await axios({
        url: this.API_URL + this.models.emotion,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: { inputs: text },
        timeout: 10000 // 10 second timeout
      });

      console.log('Emotion API response status:', response.status);
      
      // Handle the response data
      let emotions = [];
      if (response.data) {
        emotions = this._extractEmotions(response.data);
      }
      
      return {
        emotions: emotions,
        rawResponse: response.data
      };
    } catch (error) {
      console.error('Error analyzing emotions:', error);
      
      // Log more details about the error
      if (error.response) {
        console.error('Emotion API error response:', error.response.status, error.response.data);
      }
      
      // Fallback to rule-based emotion detection
      console.log('Using fallback emotion analysis due to API error');
      return {
        emotions: this._fallbackEmotionAnalysis(text),
        error: error.message,
        source: 'fallback'
      };
    }
  }
  
  _extractEmotions(data) {
    try {
      // Debug log to see the actual data structure
      console.log('Emotion API response data structure:', JSON.stringify(data).substring(0, 200));
      
      // Handle bhadresh-savani/distilbert-base-uncased-emotion format
      if (Array.isArray(data)) {
        return data
          .filter(item => item && item.label) // Make sure item and label exist
          .map(item => ({
            name: item.label.toLowerCase(),
            score: item.score || 0
          }))
          .sort((a, b) => b.score - a.score);
      }
      
      // Original format handling
      if (Array.isArray(data) && data[0] && Array.isArray(data[0])) {
        return data[0]
          .filter(emotion => emotion && emotion.label) // Make sure emotion and label exist
          .map(emotion => ({
            name: emotion.label.toLowerCase(),
            score: emotion.score || 0
          }))
          .sort((a, b) => b.score - a.score);
      }
      
      // If we get here, the data format isn't what we expected
      console.log('Unexpected emotion data format:', typeof data, data);
      return this._fallbackEmotionAnalysis(''); // Use fallback with empty string
    } catch (error) {
      console.error('Error in _extractEmotions:', error);
      return this._fallbackEmotionAnalysis(''); // Use fallback with empty string on error
    }
  }
  
  _fallbackEmotionAnalysis(text) {
    const lowerText = text.toLowerCase();
    const emotions = [
      { name: 'sadness', score: 0 },
      { name: 'joy', score: 0 },
      { name: 'fear', score: 0 },
      { name: 'anger', score: 0 },
      { name: 'surprise', score: 0 },
      { name: 'anxiety', score: 0 } 
    ];
    
    // Simple keyword-based scoring
    const emotionKeywords = {
      sadness: ['sad', 'depressed', 'unhappy', 'miserable', 'hopeless'],
      joy: ['happy', 'joyful', 'excited', 'pleased', 'delighted'],
      fear: ['afraid', 'scared', 'terrified'],
      anxiety: ['anxious', 'worried', 'nervous', 'panic', 'stress', 'tense'],
      anger: ['angry', 'mad', 'furious', 'irritated', 'annoyed'],
      surprise: ['surprised', 'shocked', 'amazed', 'astonished']
    };
    
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          const emotionObj = emotions.find(e => e.name === emotion);
          if (emotionObj) {
            emotionObj.score += 0.2; 
          }
        }
      }
    }
    
    // Normalize scores
    for (const emotion of emotions) {
      emotion.score = Math.min(1, emotion.score); 
    }
    
    // Sort by score descending
    return emotions.sort((a, b) => b.score - a.score);
  }

  async summarizeText(text, maxLength = 100) {
    try {
      // Check if API key is configured
      if (!this.API_KEY) {
        throw new Error('Hugging Face API key is not configured');
      }
      
      const response = await axios({
        url: this.API_URL + this.models.summarization,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: { 
          inputs: text,
          parameters: {
            max_length: maxLength,
            min_length: 30,
            do_sample: false
          }
        }
      });

      return {
        summary: response.data[0].summary_text,
        rawResponse: response.data
      };
    } catch (error) {
      console.error('Error summarizing text:', error);
      
      // Simple extractive summarization as fallback
      return {
        summary: this._extractiveSummarize(text, maxLength),
        error: error.message,
        source: 'fallback'
      };
    }
  }
  
  _extractiveSummarize(text, maxLength) {
    // Simple extractive summarization by taking the first sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    let summary = '';
    let currentLength = 0;
    
    for (const sentence of sentences) {
      if (currentLength + sentence.length <= maxLength) {
        summary += sentence;
        currentLength += sentence.length;
      } else {
        break;
      }
    }
    
    return summary.trim();
  }

  async analyzeJournalEntry(entry) {
    // Extract text content from the entry
    let textToAnalyze = '';
    let quickMood = '';
    
    try {
      // Handle different possible entry formats
      if (typeof entry === 'string') {
        textToAnalyze = entry;
      } else if (entry.text) {
        textToAnalyze = entry.text;
      } else if (entry.journalFields) {
        // Extract quickMood value if present
        if (entry.journalFields.quickMood) {
          quickMood = entry.journalFields.quickMood;
          console.log('Detected quickMood in entry:', quickMood);
        }
        
        // Extract text from journalFields
        for (const key in entry.journalFields) {
          if (typeof entry.journalFields[key] === 'string') {
            textToAnalyze += `${key}: ${entry.journalFields[key]} `;
          }
        }
      } else if (entry.responses) {
        // Extract text from all fields
        if (Array.isArray(entry.responses)) {
          // If responses is an array
          entry.responses.forEach(response => {
            if (response.text) {
              textToAnalyze += response.text + ' ';
            } else if (response.answer) {
              textToAnalyze += response.answer + ' ';
            }
          });
        } else {
          // If responses is an object with key-value pairs
          for (const key in entry.responses) {
            if (typeof entry.responses[key] === 'string') {
              textToAnalyze += `${key}: ${entry.responses[key]} `;
            } else if (entry.responses[key] && entry.responses[key].text) {
              textToAnalyze += entry.responses[key].text + ' ';
            }
          }
        }
      }
      
      textToAnalyze = textToAnalyze.trim();
      
      // If quick mood is set to "positive", append it to the text to analyze
      if (quickMood === 'positive') {
        textToAnalyze += ' Quick Mood: positive';
      }
      
      if (!textToAnalyze) {
        return {
          error: 'No text content to analyze'
        };
      }

      console.log(`Analyzing journal entry text (${textToAnalyze.length} chars)`);

      // Run parallel analyses
      // Changed: Now handling sentiment analysis differently to ensure varied results
      let sentimentResult;
      try {
        sentimentResult = await this.analyzeSentiment(textToAnalyze);
      } catch (sentimentError) {
        console.error('Error in sentiment analysis, using basic analysis:', sentimentError);
        
        // Apply very basic sentiment analysis for variety
        const lowerText = textToAnalyze.toLowerCase();
        
        const negativeTerms = ['sad', 'unhappy', 'depressed', 'anxious', 'worried', 'struggling', 
                              'difficult', 'stressed', 'fear', 'upset', 'angry', 'frustrat'];
        const positiveTerms = ['happy', 'joy', 'grateful', 'content', 'excited', 'peaceful', 
                              'relaxed', 'proud', 'accomplish', 'success', 'hope', 'love'];
        
        let negativeCount = 0;
        let positiveCount = 0;
        
        negativeTerms.forEach(term => {
          if (lowerText.includes(term)) negativeCount++;
        });
        
        positiveTerms.forEach(term => {
          if (lowerText.includes(term)) positiveCount++;
        });
        
        let sentiment;
        if (negativeCount > positiveCount) {
          sentiment = { type: 'negative', score: 65 + (negativeCount * 5), confidence: 0.7 };
        } else if (positiveCount > negativeCount) {
          sentiment = { type: 'positive', score: 65 + (positiveCount * 5), confidence: 0.7 };
        } else {
          sentiment = { type: 'neutral', score: 50, confidence: 0.5 };
        }
        
        sentimentResult = { sentiment, source: 'fallback-basic-analysis' };
      }

      // Continue with other analyses
      const [emotionResult, summaryResult] = await Promise.all([
        this.analyzeEmotion(textToAnalyze),
        this.analyzeEmotion(textToAnalyze),
        this.summarizeText(textToAnalyze)
      ]);

      // Detect any urgent flags for mental health concerns
      const flags = [];
      if (sentimentResult.sentiment.flags) {
        flags.push(...sentimentResult.sentiment.flags);
      }
      
      // Check for suicidal ideation as highest priority
      const suicidalCheck = this._checkSuicidalIdeation(textToAnalyze);
      if (suicidalCheck.detected) {
        flags.push('suicidal_ideation');
        flags.push('urgent');
      }

      // Create the analysis result
      const result = {
        sentiment: sentimentResult.sentiment,
        emotions: emotionResult.emotions,
        summary: summaryResult.summary,
        flags: flags.length > 0 ? flags : undefined,
        timestamp: new Date(),
        source: sentimentResult.source || 'mixed' // Indicate data source
      };

      // Extract key phrases that influenced the sentiment analysis
      const extractKeyPhrases = (text, sentiment) => {
        // If no text or sentiment, return empty array
        if (!text || !sentiment) return [];
        
        const highlightedPhrases = [];
        
        // Get relevant keyword lists based on the detected sentiment
        let relevantKeywords = [];
        
        if (sentiment.type === 'positive') {
          relevantKeywords = [
            ...this.mentalHealthKeywords.positive,
            ...this.mentalHealthKeywords.improvement
          ];
        } else if (sentiment.type === 'negative') {
          relevantKeywords = [
            ...this.mentalHealthKeywords.depression,
            ...this.mentalHealthKeywords.anxiety, 
            ...this.mentalHealthKeywords.trauma
          ];
        }
        
        // Break text into sentences for more context
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        
        sentences.forEach(sentence => {
          const lowerSentence = sentence.toLowerCase().trim();
          let matched = false;
          
          // Check for keyword matches
          for (const keyword of relevantKeywords) {
            if (lowerSentence.includes(keyword)) {
              // Create a highlight with the original sentence and the matched keyword
              highlightedPhrases.push({
                text: sentence.trim(),
                keyword: keyword,
                type: sentiment.type
              });
              matched = true;
              break; // Only highlight each sentence once
            }
          }
          
          // If no match yet, check for mental health context phrases
          if (!matched) {
            // Define additional context phrases that might have influenced the analysis
            const contextKeywords = {
              negative: [
                'overwhelmed', 'struggles', 'distraction', 'uncertain', 'tired', 
                'not enough', 'weakness', 'perfectly', 'have to do everything',
                'feels full', 'trying to', 'have to be', 'impossible', 'can\'t', 
                'failing', 'isolating', 'worse'
              ],
              positive: [
                'breathing', 'patience', 'remind myself', 'allowed to take',
                'strength', 'grace', 'intentionally', 'compassion', 'acceptance'
              ]
            };
            
            // Check for negative context phrases first (these are stronger signals)
            for (const phrase of contextKeywords.negative) {
              if (lowerSentence.includes(phrase)) {
                highlightedPhrases.push({
                  text: sentence.trim(),
                  keyword: phrase,
                  type: 'negative'
                });
                matched = true;
                break;
              }
            }
            
            // Then check for positive context phrases if still no match
            if (!matched) {
              for (const phrase of contextKeywords.positive) {
                if (lowerSentence.includes(phrase)) {
                  highlightedPhrases.push({
                    text: sentence.trim(),
                    keyword: phrase,
                    type: 'positive'
                  });
                  break;
                }
              }
            }
          }
        });
        
        // Remove duplicates and limit to 5 highlights
        const uniqueHighlights = [];
        const seen = new Set();
        
        for (const highlight of highlightedPhrases) {
          if (!seen.has(highlight.text)) {
            seen.add(highlight.text);
            uniqueHighlights.push(highlight);
            
            // Limit to 5 highlights to avoid overwhelming the UI
            if (uniqueHighlights.length >= 5) break;
          }
        }
        
        return uniqueHighlights;
      };
      
      // Add highlights to the result
      if (result.sentiment) {
        const highlights = extractKeyPhrases(textToAnalyze, result.sentiment);
        if (highlights.length > 0) {
          result.highlights = highlights;
        }
      }

      // Log analysis for monitoring
      console.log(`NLP Analysis Results: ${JSON.stringify({
        textLength: textToAnalyze.length,
        sentiment: result.sentiment.type,
        score: result.sentiment.score,
        flags: result.flags,
        source: result.source,
        highlightsCount: result.highlights ? result.highlights.length : 0
      })}`);
      
      return result;
    } catch (error) {
      console.error('Error in journal analysis:', error);
      
      // Final fallback in case of any error - ENSURE VARIETY in responses
      const sentimentTypes = ['positive', 'negative', 'neutral'];
      const randomType = sentimentTypes[Math.floor(Math.random() * sentimentTypes.length)];
      
      return {
        sentiment: {
          type: randomType,
          score: randomType === 'neutral' ? 50 : (randomType === 'positive' ? 75 : 65),
          confidence: 0.5
        },
        emotions: [
          { name: randomType === 'positive' ? 'joy' : (randomType === 'negative' ? 'sadness' : 'neutral'), score: 0.7 }
        ],
        error: 'Failed to analyze journal entry',
        message: error.message,
        source: 'emergency-fallback'
      };
    }
  }
  
  _checkSuicidalIdeation(text) {
    const lowerText = text.toLowerCase();
    const suicidalPhrases = [
      'kill myself', 'want to die', 'end my life', 'suicide', 
      'no reason to live', 'better off dead', 'want to end it all'
    ];
    
    for (const phrase of suicidalPhrases) {
      if (lowerText.includes(phrase)) {
        return {
          detected: true,
          phrase: phrase
        };
      }
    }
    
    return { detected: false };
  }

  _extractSentiment(data) {
    console.log('Extracting sentiment from Hugging Face response:', JSON.stringify(data).substring(0, 300));
    
    // Handle CardiffNLP/twitter-roberta-base-sentiment format (LABEL0, LABEL_1, LABEL_2)
    if (Array.isArray(data) && Array.isArray(data[0])) {
      // For CardiffNLP model:
      // LABEL_0 = Negative
      // LABEL_1 = Neutral
      // LABEL_2 = Positive
      const negativeItem = data[0].find(item => item.label === 'LABEL_0');
      const neutralItem = data[0].find(item => item.label === 'LABEL_1');
      const positiveItem = data[0].find(item => item.label === 'LABEL_2');
      
      const negativeScore = negativeItem?.score || 0;
      const neutralScore = neutralItem?.score || 0;
      const positiveScore = positiveItem?.score || 0;
      
      console.log(`Extracted scores - Positive: ${positiveScore}, Neutral: ${neutralScore}, Negative: ${negativeScore}`);
      
      // Find highest score and determine sentiment
      if (positiveScore > neutralScore && positiveScore > negativeScore) {
        return {
          type: 'positive',
          score: Math.round(positiveScore * 100),
          confidence: positiveScore
        };
      } else if (negativeScore > neutralScore && negativeScore > positiveScore) {
        return {
          type: 'negative',
          score: Math.round(negativeScore * 100),
          confidence: negativeScore
        };
      } else {
        return {
          type: 'neutral',
          score: Math.round(neutralScore * 100),
          confidence: neutralScore
        };
      }
    }
    
    // Fix: Better handle different response formats from Hugging Face
    if (Array.isArray(data)) {
      // Format: array of classification results
      if (data[0] && Array.isArray(data[0])) {
        // Find the positive and negative scores
        const positiveItem = data[0].find(item => item.label === 'POSITIVE');
        const negativeItem = data[0].find(item => item.label === 'NEGATIVE');
        
        const positiveScore = positiveItem?.score || 0;
        const negativeScore = negativeItem?.score || 0;
        
        console.log(`Extracted scores - Positive: ${positiveScore}, Negative: ${negativeScore}`);
        
        // Determine overall sentiment
        if (positiveScore > negativeScore) {
          return {
            type: 'positive',
            score: Math.round(positiveScore * 100),
            confidence: positiveScore
          };
        } else if (negativeScore > positiveScore) {
          return {
            type: 'negative',
            score: Math.round(negativeScore * 100),
            confidence: negativeScore
          };
        } else {
          return {
            type: 'neutral',
            score: 50,
            confidence: 0.5
          };
        }
      } else if (data.length > 0) {
        // Directly process array elements
        const sentiments = data.map(item => ({
          label: item.label,
          score: item.score || 0
        }));
        
        // Find highest scoring sentiment
        const topSentiment = sentiments.reduce((prev, current) => 
          (current.score > prev.score) ? current : prev, { score: 0 });
        
        if (topSentiment.label === 'POSITIVE') {
          return {
            type: 'positive',
            score: Math.round(topSentiment.score * 100),
            confidence: topSentiment.score
          };
        } else if (topSentiment.label === 'NEGATIVE') {
          return {
            type: 'negative',
            score: Math.round(topSentiment.score * 100),
            confidence: topSentiment.score
          };
        } else {
          return {
            type: 'neutral',
            score: 50,
            confidence: 0.5
          };
        }
      }
    }
    
    // Default fallback for unexpected format
    console.log('Using default sentiment extraction due to unexpected data format');
    return { type: 'neutral', score: 50, confidence: 0.5 };
  }
}

module.exports = new NLPService();