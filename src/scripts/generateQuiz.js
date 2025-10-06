import { QuizService } from '../services/quizService.js';
import { getTopicsForLevel } from '../ai/topics.js';
import database from '../config/db.js';
import { createLogger } from '../utils/helpers.js';

const logger = createLogger('QUIZ_GENERATOR');

async function generateBulkQuizzes() {
  try {
    logger.info('🚀 Starting bulk quiz generation...');
    
    // Connect to database
    await database.connect();
    logger.info('✅ Database connected');

    // Define levels and topics
    const levels = ['beginner', 'intermediate', 'advanced'];
    const quizzesPerLevelTopic = 3;

    let totalGenerated = 0;
    const results = [];

    for (const level of levels) {
      const topics = getTopicsForLevel(level);
      logger.info(`📚 Generating quizzes for ${level} level...`);
      
      for (const topic of topics) {
        logger.info(`  📝 Topic: ${topic}`);
        
        for (let i = 0; i < quizzesPerLevelTopic; i++) {
          try {
            const quiz = await QuizService.generateQuiz(level, topic, true);
            
            // Save the generated quiz
            const { Quiz } = await import('../models/Quiz.js');
            const savedQuiz = await Quiz.create({
              title: quiz.title,
              description: quiz.description,
              level: quiz.level,
              topic: quiz.topic,
              questions: quiz.questions,
              aiGenerated: true,
              createdBy: 'BULK_GENERATOR'
            });

            results.push(savedQuiz);
            totalGenerated++;

            logger.info(`    ✅ Generated quiz ${i + 1}/${quizzesPerLevelTopic}: ${savedQuiz.title}`);
            
            // Add delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            logger.error(`    ❌ Failed to generate quiz ${i + 1} for ${level} - ${topic}:`, error.message);
          }
        }
      }
    }

    logger.info(`🎉 Bulk generation completed!`);
    logger.info(`📊 Statistics:`);
    logger.info(`   Total quizzes generated: ${totalGenerated}`);
    
    // Print summary by level
    const summary = {};
    results.forEach(quiz => {
      if (!summary[quiz.level]) {
        summary[quiz.level] = {};
      }
      if (!summary[quiz.level][quiz.topic]) {
        summary[quiz.level][quiz.topic] = 0;
      }
      summary[quiz.level][quiz.topic]++;
    });

    Object.keys(summary).forEach(level => {
      logger.info(`   ${level}:`);
      Object.keys(summary[level]).forEach(topic => {
        logger.info(`     ${topic}: ${summary[level][topic]} quizzes`);
      });
    });

  } catch (error) {
    logger.error('❌ Bulk generation failed:', error);
  } finally {
    await database.close();
    logger.info('📪 Database connection closed');
    process.exit(0);
  }
}

// Check if script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateBulkQuizzes();
}

export { generateBulkQuizzes };