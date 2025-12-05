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
- Docker

## Prerequisites

In order to use Verdant, these will need to be installed:
- Node.js
- PostgreSQL
- Docker and Docker Compose

## Instructions

Note: when running this application locally, Docker is reccomended.

- Clone the repository and change to that directory
- This project was developed using Docker. Running locally without Docker requires manually installing PostgreSQL, setting environment variables, and running:
  - npm install
  - npm start
- To start all services with Docker
  - docker-compose up --build
- Visit application at http://localhost:3000 


## Running the tests

This project uses **Mocha** and **Chai** for backend testing.

### Running tests locally (without Docker)

1. Install dependencies
2. Run the test suite

### Running tests with Docker

If you prefer to run everything inside the container:
1. docker-compose run --rm backend npm test

## Link to deployed app

https://verdant-aamx.onrender.com/
