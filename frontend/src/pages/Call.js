import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Container, TextField, Button, Typography, Paper } from '@mui/material';
import { Send as SendIcon, Phone as PhoneIcon } from '@mui/icons-material';

const Call = () => {
    const { callSid } = useParams();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleTestCall = async () => {
        try {
            const response = await fetch('https://backend-empty-fire-4935.fly.dev/calls/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone_number: '5105705463'
                })
            });
            const data = await response.json();
            if (data.status === 'success') {
                console.log('Test call initiated:', data.call_sid);
            }
        } catch (error) {
            console.error('Error initiating test call:', error);
        }
    };

    const handleSend = async () => {
        if (input.trim()) {
            setIsProcessing(true);
            try {
                const response = await fetch('https://backend-empty-fire-4935.fly.dev/calls/answer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        CallSid: callSid,
                        SpeechResult: input
                    })
                });
                
                const data = await response.text();
                setMessages(prev => [
                    ...prev,
                    { text: input, sender: 'user' },
                    { text: data, sender: 'agent' }
                ]);
            } catch (error) {
                console.error('Error sending message:', error);
                setMessages(prev => [
                    ...prev,
                    { text: input, sender: 'user' },
                    { text: 'Sorry, there was an error processing your message.', sender: 'agent' }
                ]);
            }
            setInput('');
            setIsProcessing(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <Container maxWidth="md" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">
                    Call Session: {callSid}
                </Typography>
                {/* Temporary test call button - REMOVE BEFORE DEPLOYMENT */}
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<PhoneIcon />}
                    onClick={handleTestCall}
                    sx={{ 
                        bgcolor: '#ff4081',
                        '&:hover': {
                            bgcolor: '#f50057'
                        }
                    }}
                >
                    Test Call (510-570-5463)
                </Button>
            </Box>
            
            <Paper 
                elevation={3} 
                sx={{ 
                    flex: 1, 
                    mb: 2, 
                    p: 2, 
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                }}
            >
                {messages.map((message, index) => (
                    <Box
                        key={index}
                        sx={{
                            alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '70%',
                            bgcolor: message.sender === 'user' ? 'primary.main' : 'grey.200',
                            color: message.sender === 'user' ? 'white' : 'text.primary',
                            p: 2,
                            borderRadius: 2,
                        }}
                    >
                        <Typography>{message.text}</Typography>
                    </Box>
                ))}
                <div ref={messagesEndRef} />
            </Paper>

            <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isProcessing}
                />
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSend}
                    disabled={!input.trim() || isProcessing}
                    endIcon={<SendIcon />}
                >
                    Send
                </Button>
            </Box>
        </Container>
    );
};

export default Call; 