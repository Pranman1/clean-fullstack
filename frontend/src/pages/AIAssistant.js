import React, { useState, useRef, useEffect } from 'react';
import './AIAssistantChat.css';

const AIAssistant = () => {
  const [messages, setMessages] = useState([
    { text: "Hey there, you've reached Cinesis — this is Skye. What are you hauling and where are you headed?", sender: 'agent' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setIsProcessing(true);

    try {
      const response = await fetch('http://localhost:8000/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();
      if (data.status === 'success') {
        setMessages(prev => [...prev, { text: data.response, sender: 'agent' }]);
      } else {
        throw new Error(data.detail || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        text: "I apologize, but I'm experiencing technical difficulties. Please try again.",
        sender: 'agent'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="ai-voice-container">
      <div className="hero-section">
        <h1>Cinesis AI Assistant</h1>
        <p>Your intelligent logistics partner, ready to help you find and book loads through natural conversation</p>
      </div>

      <div className="main-content">
        <div className="chat-container">
          <div className="chat-header">
            <div className="agent-info">
              <div className="agent-avatar">
                <i className="fas fa-robot"></i>
              </div>
              <div className="agent-details">
                <h3>Skye</h3>
                <p>Logistics AI Assistant</p>
              </div>
            </div>
            <div className="connection-status online">
              <span className="status-dot"></span>
              Online
            </div>
          </div>

          <div className="messages-container">
            <div className="messages">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message ${message.sender}`}
                >
                  <div className="message-content">
                    {message.text}
                  </div>
                  <div className="message-time">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="message agent">
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="chat-input">
            <div className="input-container">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message here..."
                disabled={isProcessing}
              />
              <button type="submit" disabled={isProcessing || !input.trim()}>
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </form>
        </div>

        <div className="features-section">
          <h2>Why Use Our AI Assistant?</h2>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-search"></i>
              </div>
              <h3>Smart Load Search</h3>
              <p>Find the perfect loads with intelligent filtering and matching based on your preferences</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-bolt"></i>
              </div>
              <h3>Instant Responses</h3>
              <p>Get immediate answers to your questions and real-time load information</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-history"></i>
              </div>
              <h3>Context Awareness</h3>
              <p>The AI remembers your preferences and previous interactions for better assistance</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-tasks"></i>
              </div>
              <h3>Load Management</h3>
              <p>Easily save, book, and manage your loads through natural conversation</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-calculator"></i>
              </div>
              <h3>Rate Analysis</h3>
              <p>Get instant rate calculations and comparisons to make informed decisions</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-route"></i>
              </div>
              <h3>Route Planning</h3>
              <p>Optimize your routes and find loads that match your preferred lanes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant; 