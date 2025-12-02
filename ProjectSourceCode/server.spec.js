
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