import React from 'react';
import { Navbar, Container, Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Navigation = () => {
  return (
    <Navbar bg="light" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">Cinesis</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">Search Loads</Nav.Link>
            <Nav.Link as={Link} to="/saved-loads">Saved Loads</Nav.Link>
            <Nav.Link as={Link} to="/booked-loads">Booked Loads</Nav.Link>
            <Nav.Link as={Link} to="/ai-assistant">AI Assistant</Nav.Link>
            <Nav.Link as={Link} to="/voice-agent">Voice Agent</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation; 