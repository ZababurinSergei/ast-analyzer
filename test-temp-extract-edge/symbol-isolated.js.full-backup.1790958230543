
        const id = Symbol('id');
        const name = Symbol('name');
        
        function createUser(userId, userName) {
          return {
            [id]: userId,
            [name]: userName
          };
        }
        
        function getUserId(user) {
          return user[id];
        }
        
        function main() {
          const user = createUser(1, 'John');
          return getUserId(user);
        }
        export { main, createUser, getUserId };
      