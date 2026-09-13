# Architecture fonctionnelle

## Entités principales

### Bakery
- name
- address
- postal_code
- arrondissement
- latitude
- longitude
- type
- website
- phone
- photo_url
- eclair_name
- eclair_price
- availability_status
- source_url
- verified_at
- verification_note

### Vote
- bakery_id
- chocolate_taste
- filling
- choux_pastry
- glaze
- texture_balance
- value_for_money
- score
- comment
- verified_tasting
- tasting_latitude
- tasting_longitude

### Favorite
- bakery_id
- status: to_try | tasted

## Formule de score
- goût du chocolat : 30 %
- crème / garniture : 20 %
- pâte à choux : 20 %
- glaçage : 10 %
- texture / équilibre : 10 %
- rapport qualité-prix : 10 %
