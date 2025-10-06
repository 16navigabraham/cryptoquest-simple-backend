import OpenAI from 'openai';
import config from '../config/env.js';

// Initialize OpenAI client with error handling
let openai = null;
try {
  if (config.OPENAI_API_KEY && config.OPENAI_API_KEY !== 'sk-test-key-replace-with-real-key') {
    openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
  } else {
    console.warn('⚠️ OpenAI API key not configured. Quiz generation will use mock data.');
  }
} catch (error) {
  console.error('❌ Failed to initialize OpenAI client:', error.message);
}

export class QuizAgent {
  static async generateQuiz(level, topic, questionCount = 5) {
    try {
      // If no OpenAI client, return mock quiz for development
      if (!openai) {
        return this.generateMockQuiz(level, topic, questionCount);
      }

      const prompt = this.buildPrompt(level, topic, questionCount);
      
      const response = await openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: "You are an expert Solidity and blockchain educator. Generate high-quality quiz questions that test practical knowledge and understanding."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const rawContent = response.choices[0].message.content;
      const quizData = this.parseQuizResponse(rawContent);
      
      // Validate the generated quiz
      this.validateQuiz(quizData);
      
      return {
        title: `${this.capitalizeLevel(level)} ${this.formatTopic(topic)} Quiz`,
        description: `Test your ${level} knowledge in ${this.formatTopic(topic)}`,
        level,
        topic,
        questions: quizData.questions,
        aiGenerated: true,
        metadata: {
          model: config.OPENAI_MODEL,
          generatedAt: new Date(),
          promptVersion: '1.0'
        }
      };
    } catch (error) {
      console.error('Error generating quiz with AI:', error);
      
      // Fallback to mock quiz if AI fails
      console.log('Falling back to mock quiz...');
      return this.generateMockQuiz(level, topic, questionCount);
    }
  }

  // Mock quiz generation for development/testing
  static generateMockQuiz(level, topic, questionCount = 5) {
    const mockQuestions = {
      'solidity-basics': [
        {
          question: "What is the correct way to declare a state variable in Solidity?",
          options: [
            "var myVariable = 42;",
            "uint256 public myVariable = 42;",
            "let myVariable = 42;",
            "const myVariable = 42;"
          ],
          correctAnswer: "B",
          explanation: "In Solidity, state variables are declared with their type, visibility, and optional initial value."
        },
        {
          question: "Which keyword is used to make a function callable by external contracts?",
          options: [
            "internal",
            "private", 
            "public",
            "external"
          ],
          correctAnswer: "D",
          explanation: "The 'external' keyword allows a function to be called from outside the contract, typically by other contracts or transactions."
        }
      ],
      'smart-contracts': [
        {
          question: "What is the purpose of the constructor in a Solidity contract?",
          options: [
            "To destroy the contract",
            "To initialize the contract state",
            "To handle external calls",
            "To define contract interfaces"
          ],
          correctAnswer: "B",
          explanation: "The constructor is executed once when the contract is deployed and is used to initialize the contract's state variables."
        }
      ],
      'defi': [
        {
          question: "What does AMM stand for in DeFi?",
          options: [
            "Automated Market Maker",
            "Advanced Money Management",
            "Algorithmic Mining Machine",
            "Asset Management Module"
          ],
          correctAnswer: "A",
          explanation: "AMM stands for Automated Market Maker, which is a protocol that uses mathematical formulas to price assets and facilitate trading."
        }
      ]
    };

    const questions = mockQuestions[topic] || mockQuestions['solidity-basics'];
    const selectedQuestions = questions.slice(0, Math.min(questionCount, questions.length));

    // Fill remaining slots with variations if needed
    while (selectedQuestions.length < questionCount) {
      selectedQuestions.push(...questions.slice(0, questionCount - selectedQuestions.length));
    }

    return {
      title: `${this.capitalizeLevel(level)} ${this.formatTopic(topic)} Quiz (Demo)`,
      description: `Demo quiz for ${level} level ${this.formatTopic(topic)}`,
      level,
      topic,
      questions: selectedQuestions.slice(0, questionCount),
      aiGenerated: false, // Mark as demo/mock
      metadata: {
        model: 'mock',
        generatedAt: new Date(),
        promptVersion: 'demo'
      }
    };
  }

  static buildPrompt(level, topic, questionCount) {
    const levelGuidelines = {
      beginner: "Focus on basic concepts, syntax, and fundamental understanding. Questions should be straightforward.",
      intermediate: "Include moderate complexity with practical applications and common patterns.",
      advanced: "Test deep understanding, advanced patterns, optimization, and security considerations.",
      expert: "Focus on complex scenarios, edge cases, gas optimization, and architectural decisions.",
      master: "Include cutting-edge concepts, complex interactions, and expert-level problem solving."
    };

    const topicDetails = {
      'solidity-basics': 'data types, variables, functions, modifiers, events',
      'smart-contracts': 'contract structure, inheritance, interfaces, libraries',
      'defi': 'tokens, DEXs, liquidity pools, yield farming, lending protocols',
      'security': 'vulnerabilities, attack patterns, security best practices, auditing',
      'gas-optimization': 'gas costs, optimization techniques, storage patterns',
      'advanced-patterns': 'proxy patterns, factory patterns, diamond pattern',
      'testing': 'testing frameworks, test patterns, mock contracts',
      'oracles': 'price feeds, oracle patterns, chainlink integration'
    };

    return `
Generate ${questionCount} multiple-choice quiz questions for ${level} level on the topic of "${topic}".

Level Guidelines: ${levelGuidelines[level]}
Topic Focus: ${topicDetails[topic] || topic}

Requirements:
1. Each question must have exactly 4 options (A, B, C, D)
2. Only one correct answer per question
3. Include a brief explanation for the correct answer
4. Questions should be practical and relevant to real-world Solidity development
5. Avoid overly theoretical or trick questions
6. Use clear, concise language

Return the response in this exact JSON format:
{
  "questions": [
    {
      "question": "What is the purpose of the 'modifier' keyword in Solidity?",
      "options": [
        "To modify variable values",
        "To create reusable code that can be applied to functions",
        "To modify contract state",
        "To modify function visibility"
      ],
      "correctAnswer": "B",
      "explanation": "Modifiers in Solidity are reusable pieces of code that can be applied to functions to add common functionality like access control or input validation."
    }
  ]
}

Generate ${questionCount} questions now:`;
  }

  static parseQuizResponse(content) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      return parsed;
    } catch (error) {
      console.error('Error parsing quiz response:', error);
      console.error('Raw content:', content);
      throw new Error('INVALID_QUIZ_FORMAT');
    }
  }

  static validateQuiz(quizData) {
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error('Invalid quiz format: questions array missing');
    }

    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      
      if (!q.question || typeof q.question !== 'string') {
        throw new Error(`Question ${i + 1}: Invalid question text`);
      }
      
      if (!q.options || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Question ${i + 1}: Must have exactly 4 options`);
      }
      
      if (!q.correctAnswer || !['A', 'B', 'C', 'D'].includes(q.correctAnswer)) {
        throw new Error(`Question ${i + 1}: Invalid correct answer`);
      }
      
      if (!q.explanation || typeof q.explanation !== 'string') {
        throw new Error(`Question ${i + 1}: Explanation required`);
      }
    }
  }

  static async validateAnswer(question, userAnswer, correctAnswer) {
    // Simple validation - in a more advanced system, you could use AI to validate
    // partial credit or analyze the reasoning behind answers
    return {
      isCorrect: userAnswer === correctAnswer,
      correctAnswer: correctAnswer,
      explanation: question.explanation
    };
  }

  static async generateTopicQuestions(level, topics, questionsPerTopic = 2) {
    try {
      const allQuestions = [];
      
      for (const topic of topics) {
        const quiz = await this.generateQuiz(level, topic, questionsPerTopic);
        allQuestions.push(...quiz.questions.map(q => ({ ...q, topic })));
      }
      
      // Shuffle questions
      const shuffled = this.shuffleArray(allQuestions);
      
      return {
        title: `${this.capitalizeLevel(level)} Mixed Topics Quiz`,
        description: `Test your ${level} knowledge across multiple topics`,
        level,
        topic: 'mixed',
        questions: shuffled.slice(0, 5), // Return 5 questions max
        aiGenerated: true
      };
    } catch (error) {
      console.error('Error generating topic questions:', error);
      throw error;
    }
  }

  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static capitalizeLevel(level) {
    return level.charAt(0).toUpperCase() + level.slice(1);
  }

  static formatTopic(topic) {
    return topic
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Method to generate quiz questions in bulk for seeding database
  static async generateBulkQuizzes(levels, topics, quizzesPerCombination = 3) {
    try {
      const generatedQuizzes = [];
      
      for (const level of levels) {
        for (const topic of topics) {
          console.log(`Generating ${quizzesPerCombination} quizzes for ${level} - ${topic}...`);
          
          for (let i = 0; i < quizzesPerCombination; i++) {
            try {
              const quiz = await this.generateQuiz(level, topic);
              generatedQuizzes.push(quiz);
              
              // Add delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              console.error(`Failed to generate quiz ${i + 1} for ${level} - ${topic}:`, error);
            }
          }
        }
      }
      
      return generatedQuizzes;
    } catch (error) {
      console.error('Error in bulk quiz generation:', error);
      throw error;
    }
  }
}