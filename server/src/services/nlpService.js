// server/src/services/nlpService.js - PRODUCTION-READY FOR DEPRESSION ANALYSIS
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
    this.API_KEY = process.env.HUGGING_FACE_API_KEY;
    
    // PRODUCTION-READY: Multiple models for ensemble voting
    this.models = {
      sentiment: {
        primary: "cardiffnlp/twitter-roberta-base-sentiment",      // Reliable, tested
        secondary: "nlptown/bert-base-multilingual-uncased-sentiment", // 5-star system
        fallback: "j-hartmann/sentiment-roberta-large-english-3-classes" // High accuracy
      },
      emotion: "j-hartmann/emotion-english-distilroberta-base",
      summarization: "facebook/bart-large-cnn"
    };

    // PRODUCTION: Model health tracking
    this.modelHealth = {
      sentiment: {
        primary: { failures: 0, lastSuccess: null, healthy: true },
        secondary: { failures: 0, lastSuccess: null, healthy: true },
        fallback: { failures: 0, lastSuccess: null, healthy: true }
      },
      emotion: { failures: 0, lastSuccess: null, healthy: true }
    };

    // PRODUCTION: Circuit breaker pattern
    this.circuitBreaker = {
      maxFailures: 3,
      resetTimeoutMs: 300000, // 5 minutes
      isOpen: false,
      lastFailureTime: null
    };

    // Initialize depression-focused mental health model
    this.mentalHealthModel = {
      vocabulary: new Map(),
      categories: ['positive', 'negative', 'neutral', 'depression_risk'], 
      categoryWeights: {
        'positive': new Map(),
        'negative': new Map(),
        'neutral': new Map(),
        'depression_risk': new Map()
      },
      trained: false
    };

    // Path to downloaded dataset
    this.datasetPath = path.join(__dirname, '../data/Combined Data.csv');
    
    // PRODUCTION: Memory optimization for Heroku
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      console.log('🏭 Production: Initializing depression-focused AI configuration');
      
      this.maxDatasetSize = parseInt(process.env.AI_DATASET_SIZE) || 5000;
      this.enableLazyLoading = process.env.AI_STREAMING_MODE === 'true';
      this.enableGarbageCollection = process.env.AI_ENABLE_GARBAGE_COLLECTION === 'true';
      this.enableEnsemble = process.env.AI_ENABLE_ENSEMBLE !== 'false'; // Default true in production
      
      console.log(`🔧 Depression AI Settings: Dataset=${this.maxDatasetSize}, Ensemble=${this.enableEnsemble}`);
      
      if (this.enableLazyLoading) {
        this.modelPromise = null;
      } else {
        this.loadDatasetAndTrainModel();
      }
    } else {
      console.log('💻 Development: Using full depression dataset with ensemble');
      this.maxDatasetSize = 53043;
      this.enableLazyLoading = false;
      this.enableGarbageCollection = false;
      this.enableEnsemble = true;
      
      this.loadDatasetAndTrainModel();
    }

    // DEPRESSION-FOCUSED: Specialized keywords for depression analysis
    this.depressionKeywords = {
      severe_depression: [
        'hopeless', 'worthless', 'empty', 'numb', 'hollow', 'void', 'meaningless',
        'pointless', 'useless', 'failure', 'burden', 'trapped', 'stuck',
        'can\'t go on', 'give up', 'no energy', 'exhausted', 'drained'
      ],
      moderate_depression: [
        'sad', 'down', 'blue', 'depressed', 'low', 'melancholy', 'gloomy',
        'discouraged', 'disappointed', 'unmotivated', 'listless', 'apathetic',
        'withdrawn', 'isolated', 'lonely', 'disconnected'
      ],
      mild_depression: [
        'tired', 'sluggish', 'slow', 'heavy', 'weighed down', 'blah',
        'meh', 'off', 'not myself', 'flat', 'gray', 'colorless'
      ],
      depression_symptoms: [
        'sleep problems', 'insomnia', 'can\'t sleep', 'sleeping too much',
        'no appetite', 'overeating', 'weight loss', 'weight gain',
        'concentration', 'focus', 'memory', 'decision', 'guilt', 'shame',
        'irritable', 'angry', 'crying', 'tears', 'emotional'
      ],
      suicidal_ideation: [
        'suicide', 'kill myself', 'end it all', 'no reason to live', 'better off dead',
        'want to die', 'end my life', 'not worth living', 'disappear forever',
        'hurt myself', 'self harm', 'cutting', 'pills', 'overdose'
      ],
      recovery_signs: [
        'better', 'improving', 'progress', 'hope', 'trying', 'recovery',
        'healing', 'growing', 'learning', 'coping', 'managing', 'resilient',
        'therapy', 'counseling', 'medication', 'support', 'help',
        'small steps', 'one day at a time', 'getting help'
      ],
      positive_indicators: [
        'happy', 'hopeful', 'grateful', 'proud', 'calm', 'peaceful',
        'strength', 'growth', 'joy', 'content', 'optimistic', 'confident',
        'loved', 'supported', 'accomplished', 'achieved', 'succeeded'
      ]
    };

    // DEPRESSION SCORING: Risk assessment weights
    this.depressionScoring = {
      severe_depression: -30,      // Heavily negative impact
      moderate_depression: -20,    // Moderate negative impact
      mild_depression: -10,        // Mild negative impact
      depression_symptoms: -15,    // Symptom indicators
      suicidal_ideation: -50,      // Highest risk flag
      recovery_signs: +15,         // Positive recovery indicators
      positive_indicators: +20     // Strong positive signs
    };

    // PRODUCTION: Initialize health check timer
    this.startHealthMonitoring();
  }

  // PRODUCTION: Health monitoring for models
  startHealthMonitoring() {
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        this.checkModelHealth();
      }, 60000); // Check every minute in production
    }
  }

  checkModelHealth() {
    const now = Date.now();
    
    // Reset circuit breaker if enough time has passed
    if (this.circuitBreaker.isOpen && 
        this.circuitBreaker.lastFailureTime && 
        (now - this.circuitBreaker.lastFailureTime) > this.circuitBreaker.resetTimeoutMs) {
      console.log('🔄 Circuit breaker reset - attempting to restore service');
      this.circuitBreaker.isOpen = false;
      this.resetModelHealth();
    }

    // Log health status
    const healthSummary = {
      circuitOpen: this.circuitBreaker.isOpen,
      primarySentimentHealth: this.modelHealth.sentiment.primary.healthy,
      secondarySentimentHealth: this.modelHealth.sentiment.secondary.healthy,
      fallbackSentimentHealth: this.modelHealth.sentiment.fallback.healthy,
      emotionHealth: this.modelHealth.emotion.healthy
    };
    
    console.log('🏥 Depression Model Health Check:', JSON.stringify(healthSummary));
  }

  resetModelHealth() {
    for (const modelType in this.modelHealth) {
      if (typeof this.modelHealth[modelType] === 'object' && this.modelHealth[modelType].failures !== undefined) {
        this.modelHealth[modelType].failures = 0;
        this.modelHealth[modelType].healthy = true;
      } else {
        for (const variant in this.modelHealth[modelType]) {
          this.modelHealth[modelType][variant].failures = 0;
          this.modelHealth[modelType][variant].healthy = true;
        }
      }
    }
  }

  recordModelFailure(modelType, variant = null) {
    const target = variant ? this.modelHealth[modelType][variant] : this.modelHealth[modelType];
    target.failures++;
    
    if (target.failures >= this.circuitBreaker.maxFailures) {
      target.healthy = false;
      console.warn(`⚠️  Depression model ${modelType}${variant ? `.${variant}` : ''} marked as unhealthy`);
    }

    // Open circuit breaker if too many total failures
    const totalFailures = Object.values(this.modelHealth.sentiment).reduce((sum, model) => sum + model.failures, 0);
    if (totalFailures >= this.circuitBreaker.maxFailures * 2) {
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.lastFailureTime = Date.now();
      console.error('🚨 Depression AI Circuit breaker OPENED - Too many model failures');
    }
  }

  recordModelSuccess(modelType, variant = null) {
    const target = variant ? this.modelHealth[modelType][variant] : this.modelHealth[modelType];
    target.lastSuccess = Date.now();
    target.failures = Math.max(0, target.failures - 1);
    target.healthy = true;
  }

  // PRODUCTION: Main sentiment analysis method
  async analyzeSentiment(text) {
    try {
      await this.ensureModelLoaded();
      
      if (!this.API_KEY) {
        throw new Error('Hugging Face API key is not configured');
      }

      // Check for explicit mood indicators first
      if (text.toLowerCase().includes('quick mood: positive') || 
          text.toLowerCase().includes('mood: positive')) {
        console.log('Explicit positive mood detected in text, overriding sentiment analysis');
        return {
          sentiment: { type: 'positive', score: 90, confidence: 0.9 },
          source: 'explicit-mood-indicator'
        };
      }
      
      console.log('🤖 Starting depression-focused AI analysis...');
      console.log(`📝 Analyzing text (${text.length} chars): ${text.substring(0, 50)}...`);
      console.log('🚀 Calling production NLP service...');
      
      // Use ensemble if enabled, otherwise single model
      if (this.enableEnsemble) {
        return await this.analyzeSentimentEnsemble(text);
      } else {
        return await this.analyzeSentimentSingle(text);
      }
      
    } catch (error) {
      console.error('Error with depression sentiment analysis:', error.message);
      return this._handleSentimentFallback(text, error);
    }
  }

  // PRODUCTION: Ensemble sentiment analysis with voting
  async analyzeSentimentEnsemble(text) {
    if (this.circuitBreaker.isOpen) {
      console.log('⚡ Circuit breaker is open, using depression custom model only');
      return this._analyzeWithCustomModelOnly(text);
    }

    const results = [];
    const models = [
      { name: 'primary', url: this.models.sentiment.primary },
      { name: 'secondary', url: this.models.sentiment.secondary },
      { name: 'fallback', url: this.models.sentiment.fallback }
    ];

    // Try each model in parallel with timeouts
    const modelPromises = models.map(async (model) => {
      if (!this.modelHealth.sentiment[model.name].healthy) {
        return null; // Skip unhealthy models
      }

      try {
        console.log(`🤖 Trying ${model.name} depression model: ${model.url}`);
        
        const response = await axios({
          url: this.API_URL + model.url,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json'
          },
          data: { inputs: text },
          timeout: 8000
        });

        this.recordModelSuccess('sentiment', model.name);
        
        return {
          model: model.name,
          url: model.url,
          result: this._extractSentimentByModel(response.data, model.url),
          confidence: response.data[0] ? Math.max(...response.data[0].map(item => item.score)) : 0.5
        };
      } catch (error) {
        console.error(`❌ Depression ${model.name} model failed:`, error.message);
        this.recordModelFailure('sentiment', model.name);
        return null;
      }
    });

    // Wait for all models with a global timeout
    try {
      const modelResults = await Promise.allSettled(modelPromises);
      
      // Collect successful results
      for (const result of modelResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
    } catch (error) {
      console.error('Depression ensemble timeout or failure:', error);
    }

    // PRODUCTION: Ensemble voting logic
    if (results.length >= 2) {
      console.log(`🗳️  Depression ensemble voting with ${results.length} models`);
      return this._ensembleVote(results, text);
    } else if (results.length === 1) {
      console.log(`✅ Single depression model result from ${results[0].model}`);
      const enhancedResult = this._enhanceWithDepressionKnowledge(text, results[0].result);
      return {
        sentiment: enhancedResult,
        source: `single-model-${results[0].model}`,
        ensemble: false
      };
    } else {
      console.log('🔄 All depression models failed, falling back to custom dataset');
      return this._analyzeWithCustomModelOnly(text);
    }
  }

  // PRODUCTION: Single model analysis (fallback when ensemble is disabled)
  async analyzeSentimentSingle(text) {
    const primaryModel = this.models.sentiment.primary;
    
    try {
      const response = await axios({
        url: this.API_URL + primaryModel,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: { inputs: text },
        timeout: 10000
      });

      console.log('Depression sentiment API response received:', response.status);
      
      const baseResult = this._extractSentimentByModel(response.data, primaryModel);
      const enhancedResult = this._enhanceWithDepressionKnowledge(text, baseResult);
      
      return {
        sentiment: enhancedResult,
        rawResponse: response.data,
        source: 'huggingface-single-primary'
      };
    } catch (error) {
      console.error('Primary depression model failed, trying fallback:', error.message);
      
      // Try fallback model
      try {
        const response = await axios({
          url: this.API_URL + this.models.sentiment.fallback,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json'
          },
          data: { inputs: text },
          timeout: 10000
        });

        const baseResult = this._extractSentimentByModel(response.data, this.models.sentiment.fallback);
        const enhancedResult = this._enhanceWithDepressionKnowledge(text, baseResult);
        
        return {
          sentiment: enhancedResult,
          rawResponse: response.data,
          source: 'huggingface-single-fallback'
        };
      } catch (fallbackError) {
        console.error('Fallback depression model also failed:', fallbackError.message);
        throw fallbackError;
      }
    }
  }

  // PRODUCTION: Smart ensemble voting
  _ensembleVote(results, text) {
    const votes = { positive: 0, negative: 0, neutral: 0 };
    const scores = { positive: [], negative: [], neutral: [] };
    const confidences = [];

    // Collect votes and scores
    results.forEach(result => {
      const sentiment = result.result;
      votes[sentiment.type]++;
      scores[sentiment.type].push(sentiment.score);
      confidences.push(result.confidence * sentiment.confidence);
    });

    console.log(`📊 Depression voting results: ${JSON.stringify(votes)}`);

    // Determine winner by majority vote
    let winningType = Object.keys(votes).reduce((a, b) => votes[a] > votes[b] ? a : b);
    
    // Calculate ensemble confidence
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    // Calculate weighted score
    let finalScore = 50; // Default neutral
    if (scores[winningType].length > 0) {
      finalScore = scores[winningType].reduce((sum, score) => sum + score, 0) / scores[winningType].length;
    }

    // If there's a tie, use the one with higher average confidence
    const tiedTypes = Object.keys(votes).filter(type => votes[type] === Math.max(...Object.values(votes)));
    if (tiedTypes.length > 1) {
      console.log(`🤝 Tie detected between: ${tiedTypes.join(', ')}, using confidence to break tie`);
      
      let bestType = tiedTypes[0];
      let bestConfidence = 0;
      
      tiedTypes.forEach(type => {
        const typeResults = results.filter(r => r.result.type === type);
        const avgTypeConfidence = typeResults.reduce((sum, r) => sum + r.confidence, 0) / typeResults.length;
        if (avgTypeConfidence > bestConfidence) {
          bestConfidence = avgTypeConfidence;
          bestType = type;
        }
      });
      
      winningType = bestType;
    }

    const ensembleResult = {
      type: winningType,
      score: Math.round(finalScore),
      confidence: avgConfidence,
      votes: votes,
      modelCount: results.length
    };

    // Apply depression-specific enhancement
    const enhancedResult = this._enhanceWithDepressionKnowledge(text, ensembleResult);
    
    return {
      sentiment: enhancedResult,
      source: 'ensemble-voting',
      ensemble: true,
      models: results.map(r => r.model)
    };
  }

  // Extract sentiment based on specific model format
  _extractSentimentByModel(data, modelUrl) {
    if (modelUrl.includes('twitter-roberta-base-sentiment')) {
      return this._extractTwitterRobertaSentiment(data);
    } else if (modelUrl.includes('nlptown/bert-base-multilingual')) {
      return this._extractNlptownSentiment(data);
    } else if (modelUrl.includes('j-hartmann/sentiment-roberta')) {
      return this._extractJHartmannSentiment(data);
    } else {
      return this._extractGenericSentiment(data);
    }
  }

  // Cardiff Twitter RoBERTa model (LABEL_0=Negative, LABEL_1=Neutral, LABEL_2=Positive)
  _extractTwitterRobertaSentiment(data) {
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return { type: 'neutral', score: 50, confidence: 0.5 };
    }

    const sentiments = data[0];
    const negativeItem = sentiments.find(s => s.label === 'LABEL_0');
    const neutralItem = sentiments.find(s => s.label === 'LABEL_1');
    const positiveItem = sentiments.find(s => s.label === 'LABEL_2');
    
    const negativeScore = negativeItem?.score || 0;
    const neutralScore = neutralItem?.score || 0;
    const positiveScore = positiveItem?.score || 0;
    
    console.log(`Twitter RoBERTa scores - Positive: ${positiveScore}, Neutral: ${neutralScore}, Negative: ${negativeScore}`);
    
    const scores = [
      { type: 'positive', score: positiveScore },
      { type: 'neutral', score: neutralScore },
      { type: 'negative', score: negativeScore }
    ];
    
    const topSentiment = scores.reduce((prev, current) => 
      current.score > prev.score ? current : prev
    );
    
    return {
      type: topSentiment.type,
      score: Math.round(topSentiment.score * 100),
      confidence: topSentiment.score
    };
  }

  // NLPTown model (1-5 stars: 1-2=negative, 3=neutral, 4-5=positive)
  _extractNlptownSentiment(data) {
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return { type: 'neutral', score: 50, confidence: 0.5 };
    }

    const sentiments = data[0];
    const topSentiment = sentiments.reduce((prev, current) => 
      current.score > prev.score ? current : prev
    );
    
    const stars = parseInt(topSentiment.label.replace(' stars', '').replace('LABEL_', ''));
    
    let type, score;
    if (stars <= 2) {
      type = 'negative';
      score = 20 + (stars * 15); // 35-50 range
    } else if (stars === 3) {
      type = 'neutral';
      score = 50;
    } else {
      type = 'positive';
      score = 50 + ((stars - 3) * 25); // 75-100 range
    }
    
    console.log(`NLPTown sentiment: ${stars} stars -> ${type} (${score})`);
    
    return {
      type: type,
      score: score,
      confidence: topSentiment.score
    };
  }

  // J-Hartmann model (usually has clear POSITIVE/NEGATIVE/NEUTRAL labels)
  _extractJHartmannSentiment(data) {
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return { type: 'neutral', score: 50, confidence: 0.5 };
    }

    const sentiments = data[0];
    const topSentiment = sentiments.reduce((prev, current) => 
      current.score > prev.score ? current : prev
    );
    
    let type = 'neutral';
    if (topSentiment.label.toLowerCase().includes('positive')) {
      type = 'positive';
    } else if (topSentiment.label.toLowerCase().includes('negative')) {
      type = 'negative';
    }
    
    console.log(`J-Hartmann sentiment: ${topSentiment.label} -> ${type}`);
    
    return {
      type: type,
      score: Math.round(topSentiment.score * 100),
      confidence: topSentiment.score
    };
  }

  // Generic fallback extraction
  _extractGenericSentiment(data) {
    console.log('Using generic sentiment extraction');
    
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const sentiments = data[0];
      const topSentiment = sentiments.reduce((prev, current) => 
        current.score > prev.score ? current : prev
      );
      
      return {
        type: 'neutral',
        score: Math.round(topSentiment.score * 100),
        confidence: topSentiment.score
      };
    }
    
    return { type: 'neutral', score: 50, confidence: 0.5 };
  }

  // DEPRESSION-FOCUSED: Enhanced domain knowledge
  _enhanceWithDepressionKnowledge(text, result) {
    const lowerText = text.toLowerCase();
    let adjustmentFactor = 0;
    let depressionRiskLevel = 'none';
    let flags = [];
    
    // Check for suicidal ideation - HIGHEST PRIORITY
    let suicidalDetected = false;
    for (const keyword of this.depressionKeywords.suicidal_ideation) {
      if (lowerText.includes(keyword)) {
        suicidalDetected = true;
        flags.push('suicidal_ideation', 'urgent', 'immediate_intervention_needed');
        adjustmentFactor += this.depressionScoring.suicidal_ideation;
        depressionRiskLevel = 'severe_crisis';
        break;
      }
    }

    if (!suicidalDetected) {
      // Check depression severity levels
      let severeCnt = 0, moderateCnt = 0, mildCnt = 0, symptomCnt = 0;
      let recoveryCnt = 0, positiveCnt = 0;

      // Count severe depression indicators
      for (const keyword of this.depressionKeywords.severe_depression) {
        if (lowerText.includes(keyword)) {
          severeCnt++;
          adjustmentFactor += this.depressionScoring.severe_depression;
        }
      }

      // Count moderate depression indicators  
      for (const keyword of this.depressionKeywords.moderate_depression) {
        if (lowerText.includes(keyword)) {
          moderateCnt++;
          adjustmentFactor += this.depressionScoring.moderate_depression;
        }
      }

      // Count mild depression indicators
      for (const keyword of this.depressionKeywords.mild_depression) {
        if (lowerText.includes(keyword)) {
          mildCnt++;
          adjustmentFactor += this.depressionScoring.mild_depression;
        }
      }

      // Count symptom indicators
      for (const keyword of this.depressionKeywords.depression_symptoms) {
        if (lowerText.includes(keyword)) {
          symptomCnt++;
          adjustmentFactor += this.depressionScoring.depression_symptoms;
        }
      }

      // Count recovery indicators
      for (const keyword of this.depressionKeywords.recovery_signs) {
        if (lowerText.includes(keyword)) {
          recoveryCnt++;
          adjustmentFactor += this.depressionScoring.recovery_signs;
        }
      }

      // Count positive indicators
      for (const keyword of this.depressionKeywords.positive_indicators) {
        if (lowerText.includes(keyword)) {
          positiveCnt++;
          adjustmentFactor += this.depressionScoring.positive_indicators;
        }
      }

      // Determine depression risk level
      if (severeCnt >= 2 || (moderateCnt >= 3 && symptomCnt >= 2)) {
        depressionRiskLevel = 'severe';
        flags.push('severe_depression_risk');
      } else if (severeCnt >= 1 || moderateCnt >= 2 || (mildCnt >= 2 && symptomCnt >= 2)) {
        depressionRiskLevel = 'moderate';
        flags.push('moderate_depression_risk');
      } else if (moderateCnt >= 1 || mildCnt >= 1 || symptomCnt >= 1) {
        depressionRiskLevel = 'mild';
        flags.push('mild_depression_risk');
      } else if (recoveryCnt >= 2 || positiveCnt >= 3) {
        depressionRiskLevel = 'recovery';
        flags.push('recovery_indicators');
      }

      console.log(`Depression analysis: Severe=${severeCnt}, Moderate=${moderateCnt}, Mild=${mildCnt}, Symptoms=${symptomCnt}, Recovery=${recoveryCnt}, Positive=${positiveCnt}, Risk=${depressionRiskLevel}, Adjustment=${adjustmentFactor}`);
    }

    // Apply adjustments to sentiment
    let newType = result.type;
    let newScore = result.score;
    
    // Override based on depression risk
    if (depressionRiskLevel === 'severe_crisis' || depressionRiskLevel === 'severe') {
      newType = 'negative';
      newScore = Math.max(5, Math.min(25, 15 + adjustmentFactor));
      flags.push('high_priority_review');
    } else if (depressionRiskLevel === 'moderate') {
      if (result.type === 'positive') {
        newType = 'neutral'; // Downgrade positive to neutral
        newScore = Math.max(30, Math.min(70, 50 + adjustmentFactor));
      } else if (result.type === 'neutral') {
        newType = 'negative';
        newScore = Math.max(20, Math.min(50, 40 + adjustmentFactor));
      } else {
        newScore = Math.max(10, Math.min(40, newScore + adjustmentFactor));
      }
    } else if (depressionRiskLevel === 'mild') {
      newScore = Math.max(0, Math.min(100, newScore + adjustmentFactor));
    } else if (depressionRiskLevel === 'recovery') {
      // Positive adjustment for recovery indicators
      if (result.type === 'negative') {
        newType = 'neutral';
        newScore = Math.max(40, Math.min(70, 50 + adjustmentFactor));
      } else {
        newScore = Math.max(0, Math.min(100, newScore + adjustmentFactor));
      }
    } else {
      // No depression indicators, use normal adjustment
      newScore = Math.max(0, Math.min(100, newScore + adjustmentFactor));
    }

    return {
      type: newType,
      score: Math.round(newScore),
      confidence: result.confidence || 0.7,
      flags: flags.length > 0 ? [...new Set(flags)] : undefined,
      depressionRisk: depressionRiskLevel,
      adjustmentFactor: adjustmentFactor
    };
  }

  // Keep your existing methods but update them for depression focus
  _analyzeWithCustomModelOnly(text) {
    if (this.mentalHealthModel.trained) {
      console.log('Using trained depression dataset model');
      const customSentiment = this._analyzeWithCustomModel(text);
      return {
        sentiment: customSentiment,
        source: 'depression-custom-dataset'
      };
    }
    
    return this._handleSentimentFallback(text, new Error('Custom model not available'));
  }

  _analyzeWithCustomModel(text) {
    if (!this.mentalHealthModel.trained) {
      return { type: 'neutral', score: 50, confidence: 0.5 };
    }
    
    const tokens = tokenizer.tokenize(text.toLowerCase());
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
    
    // Map depression_risk to negative for compatibility
    if (dominantType === 'depression_risk') {
      dominantType = 'negative';
      return this._enhanceWithDepressionKnowledge(text, {
        type: dominantType,
        score: maxScore,
        confidence: maxScore / 100,
        flags: ['depression_risk_detected']
      });
    }
    
    const enhancedResult = this._enhanceWithDepressionKnowledge(text, {
      type: dominantType,
      score: maxScore,
      confidence: maxScore / 100
    });
    
    return enhancedResult;
  }

  _handleSentimentFallback(text, error) {
    if (this.mentalHealthModel.trained) {
      console.log('Falling back to validated depression custom dataset model');
      const customSentiment = this._analyzeWithCustomModel(text);
      return {
        sentiment: customSentiment,
        source: 'depression-custom-dataset-fallback'
      };
    }
    
    // Enhanced rule-based fallback for depression
    console.log('Using enhanced depression rule-based fallback sentiment analysis');
    
    const lowerText = text.toLowerCase();
    
    // Depression-specific keyword analysis
    const depressionSentimentKeywords = {
      severe_negative: ['hopeless', 'worthless', 'suicide', 'kill myself', 'end it all', 'hate myself'],
      negative: ['sad', 'depressed', 'down', 'blue', 'empty', 'tired', 'withdrawn'],
      neutral: ['okay', 'fine', 'alright', 'normal', 'usual', 'managing'],
      positive: ['better', 'improving', 'hope', 'grateful', 'happy', 'progress'],
      recovery: ['therapy', 'medication', 'help', 'support', 'healing', 'coping']
    };
    
    let sentimentScore = 50; // Start neutral
    let matchCount = 0;
    let depressionFlags = [];
    
    for (const [category, keywords] of Object.entries(depressionSentimentKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          matchCount++;
          switch (category) {
            case 'severe_negative': 
              sentimentScore -= 35; 
              depressionFlags.push('severe_depression_indicators');
              break;
            case 'negative': 
              sentimentScore -= 20; 
              depressionFlags.push('depression_indicators');
              break;
            case 'positive': 
              sentimentScore += 20; 
              break;
            case 'recovery': 
              sentimentScore += 15; 
              depressionFlags.push('recovery_signs');
              break;
          }
        }
      }
    }
    
    // Determine type and confidence based on score and matches
    sentimentScore = Math.max(0, Math.min(100, sentimentScore));
    const confidence = Math.min(0.8, 0.4 + (matchCount * 0.1));
    
    let type = 'neutral';
    if (sentimentScore < 35) type = 'negative';
    else if (sentimentScore > 65) type = 'positive';
    
    return {
      sentiment: { 
        type, 
        score: sentimentScore, 
        confidence,
        flags: depressionFlags.length > 0 ? [...new Set(depressionFlags)] : undefined
      },
      error: error.message,
      source: 'depression-enhanced-rule-based-fallback',
      matches: matchCount
    };
  }

  // Keep your existing dataset loading methods but update for depression focus
  async loadDatasetAndTrainModel() {
    try {
      if (!fs.existsSync(this.datasetPath)) {
        console.warn(`Depression dataset file not found at ${this.datasetPath}. Using fallback sentiment analysis.`);
        return;
      }

      console.log('Loading depression-focused mental health sentiment dataset...');
      
      if (this.enableLazyLoading) {
        await this._trainFromDatasetStreaming();
      } else {
        await this._trainFromDataset();
      }
      
      if (this.enableGarbageCollection && global.gc) {
        console.log('🗑️ Running garbage collection after depression AI training');
        global.gc();
      }
      
    } catch (error) {
      console.error('Error loading depression dataset:', error);
      console.log('Using fallback depression sentiment analysis methods.');
    }
  }

  async _trainFromDatasetStreaming() {
    try {
      console.log(`🔄 Training depression model with streaming approach (max ${this.maxDatasetSize} samples)`);
      
      let processedCount = 0;
      const batchSize = 1000;
      let currentBatch = [];
      
      const textColumn = 'statement';
      const labelColumn = 'status';
      
      // Updated label mapping for depression focus
      const labelMapping = {
        'normal': 'positive',
        'depression': 'depression_risk',  // Map to our depression_risk category
        'suicidal': 'depression_risk',    // High risk
        'anxiety': 'negative',            // Related to depression
        'stress': 'negative',
        'bipolar': 'depression_risk',
        'personality disorder': 'negative'
      };

      const tfidf = new TfIdf();
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(this.datasetPath)
          .pipe(csv())
          .on('data', (row) => {
            if (processedCount >= this.maxDatasetSize) {
              return;
            }
            
            currentBatch.push(row);
            processedCount++;
            
            if (currentBatch.length >= batchSize) {
              this._processBatch(currentBatch, tfidf, textColumn, labelColumn, labelMapping);
              currentBatch = [];
              
              if (this.enableGarbageCollection && processedCount % (batchSize * 3) === 0 && global.gc) {
                global.gc();
              }
            }
          })
          .on('end', () => {
            if (currentBatch.length > 0) {
              this._processBatch(currentBatch, tfidf, textColumn, labelColumn, labelMapping);
            }
            
            this._calculateCategoryWeights();
            
            this.mentalHealthModel.trained = true;
            console.log(`Depression sentiment model trained successfully on ${processedCount} samples.`);
            resolve();
          })
          .on('error', reject);
      });
    } catch (error) {
      console.error('Error in depression streaming training:', error);
      throw error;
    }
  }

  async _trainFromDataset() {
    try {
      const results = [];
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(this.datasetPath)
          .pipe(csv())
          .on('data', (data) => {
            if (results.length < this.maxDatasetSize) {
              results.push(data);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      if (results.length === 0) {
        console.warn('No depression data found in dataset.');
        return;
      }

      console.log(`Training depression model on ${results.length} samples...`);

      const textColumn = 'statement';
      const labelColumn = 'status';

      const labelMapping = {
        'normal': 'positive',
        'depression': 'depression_risk',
        'suicidal': 'depression_risk',
        'anxiety': 'negative',
        'stress': 'negative',
        'bipolar': 'depression_risk',
        'personality disorder': 'negative'
      };

      const tfidf = new TfIdf();
      
      results.forEach((row, index) => {
        const text = row[textColumn];
        let rawLabel = row[labelColumn]?.toLowerCase();
        let label = labelMapping[rawLabel] || 'neutral';
        
        if (text) {
          const tokens = tokenizer.tokenize(text.toLowerCase());
          tfidf.addDocument(tokens, `doc_${index}`);
          
          tokens.forEach(token => {
            if (!this.mentalHealthModel.vocabulary.has(token)) {
              this.mentalHealthModel.vocabulary.set(token, new Map());
            }
            
            const tokenStats = this.mentalHealthModel.vocabulary.get(token);
            tokenStats.set(label, (tokenStats.get(label) || 0) + 1);
          });
        }
      });
      
      this._calculateCategoryWeights();
      
      this.mentalHealthModel.trained = true;
      console.log('Depression sentiment model trained successfully.');
    } catch (error) {
      console.error('Error training depression model from dataset:', error);
    }
  }

  _processBatch(batch, tfidf, textColumn, labelColumn, labelMapping) {
    batch.forEach((row, index) => {
      const text = row[textColumn];
      let rawLabel = row[labelColumn]?.toLowerCase();
      let label = labelMapping[rawLabel] || 'neutral';
      
      if (text) {
        const tokens = tokenizer.tokenize(text.toLowerCase());
        tfidf.addDocument(tokens, `batch_doc_${index}`);
        
        tokens.forEach(token => {
          if (!this.mentalHealthModel.vocabulary.has(token)) {
            this.mentalHealthModel.vocabulary.set(token, new Map());
          }
          
          const tokenStats = this.mentalHealthModel.vocabulary.get(token);
          tokenStats.set(label, (tokenStats.get(label) || 0) + 1);
        });
      }
    });
  }

  _calculateCategoryWeights() {
    for (const [token, labelCounts] of this.mentalHealthModel.vocabulary.entries()) {
      const totalMentions = Array.from(labelCounts.values()).reduce((sum, count) => sum + count, 0);
      
      for (const category of this.mentalHealthModel.categories) {
        const count = labelCounts.get(category) || 0;
        if (count > 0) {
          const weight = count / totalMentions;
          this.mentalHealthModel.categoryWeights[category].set(token, weight);
        }
      }
    }
  }

  async ensureModelLoaded() {
    if (this.enableLazyLoading && !this.mentalHealthModel.trained && !this.modelPromise) {
      console.log('📚 Loading depression AI model on-demand...');
      this.modelPromise = this.loadDatasetAndTrainModel();
    }
    
    if (this.modelPromise) {
      await this.modelPromise;
    }
  }

  // Keep your existing emotion analysis but add depression context
  async analyzeEmotion(text) {
    try {
      if (!this.API_KEY) {
        throw new Error('Hugging Face API key is not configured');
      }
      
      console.log(`Calling Hugging Face API for depression emotion analysis with model: ${this.models.emotion}`);
      
      const response = await axios({
        url: this.API_URL + this.models.emotion,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: { inputs: text },
        timeout: 10000
      });

      console.log('Depression emotion API response status:', response.status);
      
      let emotions = [];
      if (response.data) {
        emotions = this._extractEmotions(response.data);
        // Add depression-specific emotion interpretation
        emotions = this._interpretEmotionsForDepression(emotions, text);
      }
      
      return {
        emotions: emotions,
        rawResponse: response.data
      };
    } catch (error) {
      console.error('Error analyzing depression emotions:', error);
      
      if (error.response) {
        console.error('Depression emotion API error response:', error.response.status, error.response.data);
      }
      
      console.log('Using fallback depression emotion analysis due to API error');
      return {
        emotions: this._fallbackDepressionEmotionAnalysis(text),
        error: error.message,
        source: 'depression-fallback'
      };
    }
  }

  _interpretEmotionsForDepression(emotions, text) {
    const lowerText = text.toLowerCase();
    
    // Add depression-specific emotion flags
    const enhancedEmotions = emotions.map(emotion => {
      const enhanced = { ...emotion };
      
      // Flag emotions that are significant for depression assessment
      if (emotion.name === 'sadness' && emotion.score > 0.3) {
        enhanced.depressionRelevance = 'high';
        enhanced.flags = ['depression_indicator'];
      } else if (emotion.name === 'fear' && emotion.score > 0.4) {
        enhanced.depressionRelevance = 'medium';
        enhanced.flags = ['anxiety_indicator'];
      } else if (emotion.name === 'joy' && emotion.score > 0.5) {
        enhanced.depressionRelevance = 'positive';
        enhanced.flags = ['positive_indicator'];
      }
      
      return enhanced;
    });

    // Check for specific depression emotion patterns
    const sadness = emotions.find(e => e.name === 'sadness')?.score || 0;
    const joy = emotions.find(e => e.name === 'joy')?.score || 0;
    const fear = emotions.find(e => e.name === 'fear')?.score || 0;
    
    if (sadness > 0.4 && joy < 0.2) {
      enhancedEmotions.push({
        name: 'depression_pattern',
        score: sadness,
        depressionRelevance: 'high',
        flags: ['depression_emotion_pattern']
      });
    }
    
    return enhancedEmotions;
  }

  _extractEmotions(data) {
    try {
      console.log('Depression emotion API response data structure:', JSON.stringify(data).substring(0, 200));
      
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0]
          .filter(emotion => emotion && emotion.label)
          .map(emotion => ({
            name: emotion.label.toLowerCase(),
            score: emotion.score || 0
          }))
          .sort((a, b) => b.score - a.score);
      }
      
      if (Array.isArray(data)) {
        return data
          .filter(item => item && item.label)
          .map(item => ({
            name: item.label.toLowerCase(),
            score: item.score || 0
          }))
          .sort((a, b) => b.score - a.score);
      }
      
      console.log('Unexpected depression emotion data format:', typeof data, data);
      return this._fallbackDepressionEmotionAnalysis('');
    } catch (error) {
      console.error('Error in depression _extractEmotions:', error);
      return this._fallbackDepressionEmotionAnalysis('');
    }
  }
  
  _fallbackDepressionEmotionAnalysis(text) {
    const lowerText = text.toLowerCase();
    const emotions = [
      { name: 'sadness', score: 0, depressionRelevance: 'high' },
      { name: 'joy', score: 0, depressionRelevance: 'positive' },
      { name: 'fear', score: 0, depressionRelevance: 'medium' },
      { name: 'anger', score: 0, depressionRelevance: 'medium' },
      { name: 'surprise', score: 0, depressionRelevance: 'low' },
      { name: 'neutral', score: 0, depressionRelevance: 'low' }
    ];
    
    const depressionEmotionKeywords = {
      sadness: ['sad', 'depressed', 'unhappy', 'miserable', 'hopeless', 'empty', 'down', 'blue'],
      joy: ['happy', 'joyful', 'excited', 'pleased', 'delighted', 'grateful', 'content'],
      fear: ['afraid', 'scared', 'terrified', 'worried', 'anxious'],
      anger: ['angry', 'mad', 'furious', 'irritated', 'annoyed', 'frustrated'],
      surprise: ['surprised', 'shocked', 'amazed', 'astonished']
    };
    
    for (const [emotion, keywords] of Object.entries(depressionEmotionKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          const emotionObj = emotions.find(e => e.name === emotion);
          if (emotionObj) {
            emotionObj.score += 0.25; 
            if (emotion === 'sadness') {
              emotionObj.flags = ['depression_indicator'];
            }
          }
        }
      }
    }
    
    for (const emotion of emotions) {
      emotion.score = Math.min(1, emotion.score); 
    }
    
    return emotions.sort((a, b) => b.score - a.score);
  }

  // Your existing summarizeText method can stay the same
  async summarizeText(text, maxLength = 100) {
    try {
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
      console.error('Error summarizing depression text:', error);
      
      return {
        summary: this._extractiveSummarize(text, maxLength),
        error: error.message,
        source: 'fallback'
      };
    }
  }
  
  _extractiveSummarize(text, maxLength) {
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

  // Main journal analysis method - depression focused
  async analyzeJournalEntry(entry) {
    try {
      await this.ensureModelLoaded();
      
      // Extract text content from the entry
      let textToAnalyze = '';
      let quickMood = '';
      
      if (typeof entry === 'string') {
        textToAnalyze = entry;
      } else if (entry.text) {
        textToAnalyze = entry.text;
      } else if (entry.journalFields) {
        if (entry.journalFields.quickMood) {
          quickMood = entry.journalFields.quickMood;
          console.log('Detected quickMood in depression entry:', quickMood);
        }
        
        for (const key in entry.journalFields) {
          if (typeof entry.journalFields[key] === 'string') {
            textToAnalyze += `${key}: ${entry.journalFields[key]} `;
          }
        }
      } else if (entry.responses) {
        if (Array.isArray(entry.responses)) {
          entry.responses.forEach(response => {
            if (response.text) {
              textToAnalyze += response.text + ' ';
            } else if (response.answer) {
              textToAnalyze += response.answer + ' ';
            }
          });
        } else {
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
      
      if (quickMood === 'positive') {
        textToAnalyze += ' Quick Mood: positive';
      }
      
      if (!textToAnalyze) {
        return {
          error: 'No text content to analyze for depression assessment'
        };
      }

      console.log(`🧠 Analyzing depression journal entry text (${textToAnalyze.length} chars)`);

      // Run depression-focused sentiment analysis with memory optimization
      let sentimentResult;
      try {
        sentimentResult = await this.analyzeSentiment(textToAnalyze);
      } catch (sentimentError) {
        console.error('Error in depression sentiment analysis, using basic analysis:', sentimentError);
        sentimentResult = this._handleSentimentFallback(textToAnalyze, sentimentError);
      }

      // Continue with other analyses (memory-optimized)
      const [emotionResult, summaryResult] = await Promise.all([
        this.analyzeEmotion(textToAnalyze).catch(err => ({
          emotions: this._fallbackDepressionEmotionAnalysis(textToAnalyze),
          error: err.message,
          source: 'depression-fallback'
        })),
        this.summarizeText(textToAnalyze).catch(err => ({
          summary: this._extractiveSummarize(textToAnalyze, 100),
          error: err.message,
          source: 'fallback'
        }))
      ]);

      // Detect urgent flags for depression concerns
      const flags = [];
      if (sentimentResult.sentiment.flags) {
        flags.push(...sentimentResult.sentiment.flags);
      }
      
      const suicidalCheck = this._checkSuicidalIdeation(textToAnalyze);
      if (suicidalCheck.detected) {
        flags.push('suicidal_ideation');
        flags.push('urgent');
        flags.push('immediate_intervention_required');
      }

      // Create the depression analysis result
      const result = {
        sentiment: sentimentResult.sentiment,
        emotions: emotionResult.emotions,
        summary: summaryResult.summary,
        flags: flags.length > 0 ? flags : undefined,
        depressionRisk: sentimentResult.sentiment.depressionRisk || 'none',
        timestamp: new Date(),
        source: sentimentResult.source || 'mixed'
      };

      // Extract key phrases that influenced the depression analysis
      const highlights = this._extractDepressionHighlights(textToAnalyze, result.sentiment);
      if (highlights.length > 0) {
        result.highlights = highlights;
      }

      // Log depression analysis for monitoring
      console.log(`🧠 Depression NLP Analysis Results: ${JSON.stringify({
        textLength: textToAnalyze.length,
        sentiment: result.sentiment.type,
        score: result.sentiment.score,
        depressionRisk: result.depressionRisk,
        flags: result.flags,
        source: result.source,
        highlightsCount: result.highlights ? result.highlights.length : 0
      })}`);
      
      // Force garbage collection after analysis in production
      if (this.enableGarbageCollection && global.gc) {
        global.gc();
      }
      
      return result;
    } catch (error) {
      console.error('Error in depression journal analysis:', error);
      
      // Final fallback with depression awareness
      return {
        sentiment: {
          type: 'neutral',
          score: 50,
          confidence: 0.5,
          depressionRisk: 'unknown'
        },
        emotions: [
          { name: 'neutral', score: 0.7, depressionRelevance: 'low' }
        ],
        error: 'Failed to analyze depression journal entry',
        message: error.message,
        source: 'depression-emergency-fallback'
      };
    }
  }

  _extractDepressionHighlights(text, sentiment) {
    if (!text || !sentiment) return [];
    
    const highlightedPhrases = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    // All depression keywords combined for highlighting
    const allKeywords = [
      ...this.depressionKeywords.severe_depression,
      ...this.depressionKeywords.moderate_depression,
      ...this.depressionKeywords.mild_depression,
      ...this.depressionKeywords.depression_symptoms,
      ...this.depressionKeywords.suicidal_ideation,
      ...this.depressionKeywords.recovery_signs,
      ...this.depressionKeywords.positive_indicators
    ];
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase().trim();
      
      for (const keyword of allKeywords) {
        if (lowerSentence.includes(keyword)) {
          // Determine highlight type based on keyword category
          let highlightType = 'neutral';
          if (this.depressionKeywords.severe_depression.includes(keyword) || 
              this.depressionKeywords.suicidal_ideation.includes(keyword)) {
            highlightType = 'severe_concern';
          } else if (this.depressionKeywords.moderate_depression.includes(keyword) ||
                     this.depressionKeywords.depression_symptoms.includes(keyword)) {
            highlightType = 'depression_indicator';
          } else if (this.depressionKeywords.recovery_signs.includes(keyword) ||
                     this.depressionKeywords.positive_indicators.includes(keyword)) {
            highlightType = 'positive_indicator';
          }
          
          highlightedPhrases.push({
            text: sentence.trim(),
            keyword: keyword,
            type: highlightType,
            depressionRelevance: highlightType
          });
          break; // Only one highlight per sentence
        }
      }
    });
    
    // Remove duplicates and limit to 5 highlights, prioritizing severe concerns
    const uniqueHighlights = [];
    const seen = new Set();
    
    // Sort by severity: severe_concern first, then depression_indicator, then positive
    const sortedHighlights = highlightedPhrases.sort((a, b) => {
      const severity = { severe_concern: 3, depression_indicator: 2, positive_indicator: 1, neutral: 0 };
      return severity[b.type] - severity[a.type];
    });
    
    for (const highlight of sortedHighlights) {
      if (!seen.has(highlight.text)) {
        seen.add(highlight.text);
        uniqueHighlights.push(highlight);
        
        if (uniqueHighlights.length >= 5) break;
      }
    }
    
    return uniqueHighlights;
  }
  
  _checkSuicidalIdeation(text) {
    const lowerText = text.toLowerCase();
    
    for (const phrase of this.depressionKeywords.suicidal_ideation) {
      if (lowerText.includes(phrase)) {
        return {
          detected: true,
          phrase: phrase,
          severity: 'high'
        };
      }
    }
    
    return { detected: false };
  }
}

module.exports = new NLPService();