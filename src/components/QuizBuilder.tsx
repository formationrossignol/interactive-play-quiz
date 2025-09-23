import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clock, Users, Play, Save } from "lucide-react";

interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'ranking';
  question: string;
  answers: string[];
  correctAnswer: number | string;
  timeLimit: number;
  points: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  settings: {
    showLeaderboard: boolean;
    timePerQuestion: number;
    showAnswersAfterEach: boolean;
  };
}

export const QuizBuilder = () => {
  const [quiz, setQuiz] = useState<Quiz>({
    id: '',
    title: '',
    description: '',
    questions: [],
    settings: {
      showLeaderboard: true,
      timePerQuestion: 30,
      showAnswersAfterEach: true
    }
  });

  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    type: 'multiple-choice',
    question: '',
    answers: ['', '', '', ''],
    correctAnswer: 0,
    timeLimit: 30,
    points: 100
  });

  const addQuestion = () => {
    if (currentQuestion.question && currentQuestion.answers?.some(a => a.trim())) {
      const newQuestion: Question = {
        id: Date.now().toString(),
        ...currentQuestion as Question
      };
      
      setQuiz(prev => ({
        ...prev,
        questions: [...prev.questions, newQuestion]
      }));

      // Reset form
      setCurrentQuestion({
        type: 'multiple-choice',
        question: '',
        answers: ['', '', '', ''],
        correctAnswer: 0,
        timeLimit: 30,
        points: 100
      });
    }
  };

  const removeQuestion = (questionId: string) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
  };

  const getQuestionTypeColor = (type: Question['type']) => {
    switch (type) {
      case 'multiple-choice': return 'bg-gradient-primary';
      case 'true-false': return 'bg-gradient-secondary';
      case 'short-answer': return 'bg-gradient-success';
      case 'ranking': return 'bg-warning';
      default: return 'bg-gradient-primary';
    }
  };

  const getQuestionTypeLabel = (type: Question['type']) => {
    switch (type) {
      case 'multiple-choice': return 'Multiple Choice';
      case 'true-false': return 'True/False';
      case 'short-answer': return 'Short Answer';
      case 'ranking': return 'Ranking';
      default: return 'Multiple Choice';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Quiz Builder</h1>
            <p className="text-muted-foreground">Create engaging quizzes with multiple question types</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg">
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button variant="hero" size="lg">
              <Play className="w-4 h-4 mr-2" />
              Start Quiz
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quiz Settings */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Quiz Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="quiz-title">Quiz Title</Label>
                  <Input
                    id="quiz-title"
                    placeholder="Enter quiz title"
                    value={quiz.title}
                    onChange={(e) => setQuiz(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="quiz-description">Description</Label>
                  <Textarea
                    id="quiz-description"
                    placeholder="Brief description of your quiz"
                    value={quiz.description}
                    onChange={(e) => setQuiz(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="time-per-question">Default Time (seconds)</Label>
                  <Input
                    id="time-per-question"
                    type="number"
                    min="5"
                    max="120"
                    value={quiz.settings.timePerQuestion}
                    onChange={(e) => setQuiz(prev => ({
                      ...prev,
                      settings: { ...prev.settings, timePerQuestion: parseInt(e.target.value) }
                    }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Question List */}
            <Card>
              <CardHeader>
                <CardTitle>Questions ({quiz.questions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {quiz.questions.map((question, index) => (
                    <div key={question.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${getQuestionTypeColor(question.type)}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{question.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {getQuestionTypeLabel(question.type)}
                          </Badge>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 mr-1" />
                            {question.timeLimit}s
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(question.id)}
                        className="text-danger hover:text-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {quiz.questions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No questions added yet</p>
                      <p className="text-sm">Create your first question →</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Builder */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="w-5 h-5 mr-2" />
                  Add New Question
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Question Type Selector */}
                <div>
                  <Label>Question Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {(['multiple-choice', 'true-false', 'short-answer', 'ranking'] as const).map((type) => (
                      <Button
                        key={type}
                        variant={currentQuestion.type === type ? "default" : "outline"}
                        className="h-auto p-3 flex flex-col items-center"
                        onClick={() => setCurrentQuestion(prev => ({ ...prev, type }))}
                      >
                        <div className={`w-8 h-8 rounded-full mb-2 flex items-center justify-center text-white text-sm font-bold ${getQuestionTypeColor(type)}`}>
                          {type === 'multiple-choice' ? 'MC' : 
                           type === 'true-false' ? 'TF' :
                           type === 'short-answer' ? 'SA' : 'RK'}
                        </div>
                        <span className="text-xs">{getQuestionTypeLabel(type)}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <Label htmlFor="question-text">Question</Label>
                  <Textarea
                    id="question-text"
                    placeholder="Enter your question here..."
                    value={currentQuestion.question}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, question: e.target.value }))}
                    className="mt-2"
                  />
                </div>

                {/* Answer Options */}
                {currentQuestion.type === 'multiple-choice' && (
                  <div>
                    <Label>Answer Options</Label>
                    <div className="space-y-2 mt-2">
                      {currentQuestion.answers?.map((answer, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="correct-answer"
                            checked={currentQuestion.correctAnswer === index}
                            onChange={() => setCurrentQuestion(prev => ({ ...prev, correctAnswer: index }))}
                            className="text-primary"
                          />
                          <Input
                            placeholder={`Option ${index + 1}`}
                            value={answer}
                            onChange={(e) => {
                              const newAnswers = [...(currentQuestion.answers || [])];
                              newAnswers[index] = e.target.value;
                              setCurrentQuestion(prev => ({ ...prev, answers: newAnswers }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentQuestion.type === 'true-false' && (
                  <div>
                    <Label>Correct Answer</Label>
                    <div className="flex gap-4 mt-2">
                      <Button
                        variant={currentQuestion.correctAnswer === 'true' ? "success" : "outline"}
                        onClick={() => setCurrentQuestion(prev => ({ ...prev, correctAnswer: 'true', answers: ['True', 'False'] }))}
                      >
                        True
                      </Button>
                      <Button
                        variant={currentQuestion.correctAnswer === 'false' ? "success" : "outline"}
                        onClick={() => setCurrentQuestion(prev => ({ ...prev, correctAnswer: 'false', answers: ['True', 'False'] }))}
                      >
                        False
                      </Button>
                    </div>
                  </div>
                )}

                {/* Question Settings */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="time-limit">Time Limit (seconds)</Label>
                    <Input
                      id="time-limit"
                      type="number"
                      min="5"
                      max="120"
                      value={currentQuestion.timeLimit}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="points">Points</Label>
                    <Input
                      id="points"
                      type="number"
                      min="10"
                      max="1000"
                      step="10"
                      value={currentQuestion.points}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, points: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                <Button 
                  onClick={addQuestion}
                  variant="default"
                  size="lg"
                  className="w-full"
                  disabled={!currentQuestion.question || !currentQuestion.answers?.some(a => a.trim())}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};