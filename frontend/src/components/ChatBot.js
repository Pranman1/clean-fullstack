import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import './ChatBot.css';
import { API_URL } from '../config';

const ChatBot = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Generate or get user ID
    const userId = (() => {
        let id = localStorage.getItem('user_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('user_id', id);
        }
        return id;
    })();

    const purifyConfig = {
        ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    };

    const handleLinkClick = (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
        if (href.startsWith('/') || href.startsWith(API_URL)) {
            e.preventDefault();
            const relativePath = href.replace(API_URL, '');
            navigate(relativePath);
        }
    };

    const renderMessage = (content) => {
        const cleanHtml = DOMPurify.sanitize(content, purifyConfig);
        return <div onClick={handleLinkClick} dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setIsHistoryLoading(true);
                const res = await axios.get(`${API_URL}/chat/history`, {
                    headers: { 'X-User-ID': userId }
                });
                if (Array.isArray(res.data)) {
                    setMessages(res.data);
                }
            } catch (error) {
                console.error('Failed to fetch chat history:', error);
                // Set default welcome message on error
                setMessages([{
                    role: 'assistant',
                    content: 'Hi! I\'m Cindy from Cinesis. I can help you navigate our website and find loads.'
                }]);
            } finally {
                setIsHistoryLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    // Add effect to scroll to bottom when chat is opened
    useEffect(() => {
        if (isOpen && !isHistoryLoading) {
            scrollToBottom();
        }
    }, [isOpen, isHistoryLoading]);

    const handleInputChange = (e) => {
        setInputMessage(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        const userMessage = {
            role: 'user',
            content: inputMessage
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_URL}/chat`, {
                message: inputMessage
            }, {
                headers: { 'X-User-ID': userId }
            });

            const assistantMessage = {
                role: 'assistant',
                content: response.data.message
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        }

        setIsLoading(false);
    };

    return (
        <div className="chatbot-container">
            <button className={`chat-toggle-button ${isOpen ? 'open' : ''}`} onClick={toggleChat}>
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-comment-dots'}`}></i>
            </button>

            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <h3>Cindy - Website Assistant</h3>
                    </div>

                    <div className="messages-container">
                        {isHistoryLoading ? (
                            <div className="loading-container">
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        ) : (
                            messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                                >
                                    {renderMessage(message.content)}
                                </div>
                            ))
                        )}
                        {isLoading && (
                            <div className="message assistant-message">
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="chat-input-form" onSubmit={handleSubmit}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputMessage}
                            onChange={handleInputChange}
                            placeholder="Type your message..."
                            className="chat-input"
                        />
                        <button type="submit" className="send-button">
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ChatBot;
