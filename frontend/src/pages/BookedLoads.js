import React, { useState, useEffect } from 'react';
import { Card, Container, Row, Col, Badge } from 'react-bootstrap';
import { formatDate, formatCurrency } from '../utils/formatting';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = 'https://backend-empty-fire-4935.fly.dev';

const BookedLoads = () => {
    const [bookedLoads, setBookedLoads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchBookedLoads();
    }, [user, navigate]);

    const fetchBookedLoads = async () => {
        try {
            const response = await axios.get(`${API_URL}/booked-loads`);
            if (response.status === 200) {
                setBookedLoads(response.data);
            } else {
                throw new Error('Failed to fetch booked loads');
            }
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.detail || err.message);
            setLoading(false);
        }
    };

    const getStatusBadge = (load) => {
        if (load.green_light) {
            return <Badge bg="success">Ready to Go</Badge>;
        }
        return <Badge bg="warning">Pending</Badge>;
    };

    if (loading) return (
        <Container className="mt-4">
            <div className="text-center">
                <i className="fas fa-spinner fa-spin fa-2x"></i>
                <p>Loading booked loads...</p>
            </div>
        </Container>
    );

    if (error) return (
        <Container className="mt-4">
            <div className="alert alert-danger" role="alert">
                <i className="fas fa-exclamation-circle me-2"></i>
                Error: {error}
            </div>
        </Container>
    );

    return (
        <Container className="mt-4">
            <h2>Booked Loads</h2>
            {bookedLoads.length === 0 ? (
                <div className="alert alert-info" role="alert">
                    <i className="fas fa-info-circle me-2"></i>
                    No booked loads found. Book a load through our voice agent or chat to see it here!
                </div>
            ) : (
                <Row>
                    {bookedLoads.map((load) => (
                        <Col md={6} lg={4} key={load.id} className="mb-4">
                            <Card>
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <span className="font-weight-bold">{load.id}</span>
                                    {getStatusBadge(load)}
                                </Card.Header>
                                <Card.Body>
                                    <Card.Title>
                                        {load.origin_city}, {load.origin_state} →{' '}
                                        {load.destination_city}, {load.destination_state}
                                    </Card.Title>
                                    <Card.Text>
                                        <strong>Distance:</strong> {load.distance} miles
                                        <br />
                                        <strong>Rate:</strong> {formatCurrency(load.pay_rate)}
                                        {load.rate_per_mile_est && (
                                            <span> (${load.rate_per_mile_est}/mile)</span>
                                        )}
                                        <br />
                                        <strong>Ship Date:</strong> {formatDate(load.ship_date)}
                                        <br />
                                        <strong>Equipment:</strong> {load.other_trailer_types}
                                        <br />
                                        <strong>Weight:</strong> {load.weight} lbs
                                        <br />
                                        <strong>Booked On:</strong> {formatDate(load.booking_date)}
                                    </Card.Text>
                                </Card.Body>
                                <Card.Footer className="text-muted">
                                    Source: {load.data_source === 'direct_freight' ? 'Direct Freight' : 'Truckstop'}
                                </Card.Footer>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}
        </Container>
    );
};

export default BookedLoads; 