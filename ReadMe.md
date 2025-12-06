# Verdant

## Description

Our application is designed for plant enthusiasts who want a convenient and organized way to document the plants they encounter in nature or cultivate themselves. Users will be able to log individual plant findings by uploading essential information such as names, descriptions, and photos. Each entry will also include the geographic location where the plant was found, allowing users to build a personal, interactive map of their discoveries. This mapping feature adds both functionality and visual appeal, helping users recall exactly where each plant was located and observe patterns in their findings over time.

## Contributors

- Felix Conant
- Davion Hochhalter
- Ian Kyle
- Mathias Teferra
- Maya Williams

## Technology Stack

- Frontend: HTML, CSS, JavaScript, leaflet.js
- Backend: Node.js
- Database: PostgreSQL
- Version Control: Github repository
- Testing: Mocha, Chai
- Containerization: Docker

## Prerequisites

In order to use Verdant, these will need to be installed:
- Node.js
- PostgreSQL
- Docker and Docker Compose

## Instructions

**Note:** when running this application locally, Docker is recommended.

### Running tests locally (without Docker)

- Clone the repository and navigate to the project directory
- Install dependencies (npm install)
- Ensure PostgreSQL is running and required environment variables are set.
- Start the application (npm start)
- Visit the application at http://localhost:3000

### Running locally with Docker (reccomended)

- Start all services using Docker (docker-compose up --build)
- Visit the application at http://localhost:3000

## Running the tests

This project uses **Mocha** and **Chai** for backend testing.

### Running tests locally (without Docker)

1. Install dependencies (npm install)
2. Run the test suite (npm test)

### Running tests with Docker

The `web` service in `docker-compose.yml` is configured to run `npm start`, so to run tests inside the container you need to override the command: docker-compose run --rm web npm test

This will:
- Build the `web` service container if needed  
- Mount your project source  
- Use the same environment variables  
- Run Mocha inside the container  
- Exit when done  


## Link to deployed app

https://verdant-aamx.onrender.com/
