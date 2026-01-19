import { Opik } from 'opik';

// Initialize Opik client
// Uses OPIK_API_KEY from environment
const opik = new Opik({
  projectName: 'healthic',
});

export { opik };
