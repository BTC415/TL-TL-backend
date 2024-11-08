# TL-TL Trade Locker Backend

A Node.js backend service that facilitates copy trading functionality between master and slave trading accounts using the TradeLocker API.

## Features

- Master and slave account synchronization
- Secure authentication handling with JWT tokens
- Position tracking and replication
- Real-time trade copying
- Multiple slave account support
- CORS enabled API endpoints

## Tech Stack

- Node.js
- Express.js
- Axios for HTTP requests
- CORS middleware

## Prerequisites

- Node.js (v12 or higher)
- NPM or Yarn package manager
- TradeLocker API access

## Installation

```bash
npm install
```

## Environment Variables
Create a `.env` file in the root directory and define the following variables:
```
PORT=3000
JWT_SECRET=your_secret_key
TRADELOCKER_API_KEY=your_api_key
TRADELOCKER_API_SECRET=your_api_secret
```

## Getting Started

1. Install deependencies:
```bash
npm install
```
2. Start the server:
```bash
node server.js
```

## Security
- JWT tokens are used for authentication.
- Secure credential handling
- CORS protection enabled

## Architecture

The system follows a master-slave architecture where:

- Master account: Primary trading account that initiates trades
- Slave accounts: Secondary accounts that copy master account trades
- Real-time synchronization between accounts

## Contribution

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.