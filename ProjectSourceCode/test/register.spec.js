
describe('Testing Register API', () => {
  it('positive : /register', done => {
    chai
      .request(server)
      .post('/register')
      .send({id: 5, username: 'JohnDoe', password: 'password123'})
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.message).to.equals('Success');
        done();
      });
  });
  it ('negative : /register existing user', done => {
    chai
      .request(server)
      .post('/register')
      .send({id: 1, username: 'alice', password: 'password123'})
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.message).to.equals('User already exists');
        done();
      });
    });
});
describe('Testing Login API', () => {
  it('positive : /login', done => {
    chai
      .request(server)
      .post('/login')
      .send({username: 'alice', password: 'alicepassword'})
      .end((err, res) => {
        expect(res).to.have.status(200);
        done();
      });
  });
  it ('negative : /login wrong password', done => {
    chai
      .request(server)
      .post('/login')
      .send({username: 'alice ', password: 'wrongpassword'})
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
    });
  }); 
// 3) Login Route

//redirect and render

describe('Testing Redirect', () => {
  // Sample test case given to test /test endpoint.
  it('\test route should redirect to /login with 302 HTTP status code', done => {
    chai
      .request(server)
      .get('/test')
      .end((err, res) => {
        res.should.have.status(302); // Expecting a redirect status code
        res.should.redirectTo(/^.*127\.0\.0\.1.*\/login$/); // Expecting a redirect to /login with the mentioned Regex
        done();
      });
  });
});
describe('Testing Render', () => {
  // Sample test case given to test /test endpoint.
  it('test "/login" route should render with an html response', done => {
    chai
      .request(server)
      .get('/login') // for reference, see lab 8's login route (/login) which renders home.hbs
      .end((err, res) => {
        res.should.have.status(200); // Expecting a success status code
        res.should.be.html; // Expecting a HTML response
        done();
      });
  });
});
